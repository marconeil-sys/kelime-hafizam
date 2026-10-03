import { liveQuery } from 'dexie';

import { normalizeEn } from '../domain/normalize';
import { groupFromResult } from '../domain/grouping';
import {
  db,
  type Attempt,
  type KelimeDatabase,
  type SessionMode,
  type StoredWord,
  type Word,
  type WordGroup,
} from './schema';

export class WordValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WordValidationError';
  }
}

export class DuplicateWordError extends Error {
  constructor(term: string) {
    super(`“${term}” zaten kelime listenizde.`);
    this.name = 'DuplicateWordError';
  }
}

export interface NewWordInput {
  term: string;
  meanings: string[];
  partOfSpeech?: string;
  exampleEn?: string;
}

export interface BatchAddResult {
  added: StoredWord[];
  duplicates: string[];
  rejected: Array<{ term: string; reason: string }>;
}

export interface PhotoCandidateInput extends NewWordInput {
  appendToExisting: boolean;
}

export interface PhotoSaveResult {
  addedWords: number;
  updatedWords: number;
  duplicateWords: number;
  totalWords: number;
}

function cleanOptional(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned || undefined;
}

export function cleanMeanings(meanings: string[]): string[] {
  const seen = new Set<string>();
  return meanings
    .map((meaning) => meaning.trim())
    .filter((meaning) => {
      const key = meaning.toLocaleLowerCase('tr-TR');
      if (!meaning || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function assertWordInvariant(word: Word): void {
  if (!word.term.trim() || !word.normalizedTerm) {
    throw new WordValidationError('İngilizce kelime boş bırakılamaz.');
  }
  if (cleanMeanings(word.meanings).length === 0) {
    throw new WordValidationError('En az bir Türkçe anlam yazın.');
  }
  if ((word.status === 'new') !== (word.group === null)) {
    throw new WordValidationError('Yeni kelimelerin grubu boş, test edilmiş kelimelerin grubu dolu olmalıdır.');
  }
  if (word.group !== null && !([1, 2, 3, 4] as WordGroup[]).includes(word.group)) {
    throw new WordValidationError('Geçersiz kelime grubu.');
  }
}

export function makeNewWord(input: NewWordInput, now = Date.now()): Word {
  const word: Word = {
    term: input.term.trim(),
    normalizedTerm: normalizeEn(input.term),
    meanings: cleanMeanings(input.meanings),
    partOfSpeech: cleanOptional(input.partOfSpeech),
    exampleEn: cleanOptional(input.exampleEn),
    status: 'new',
    group: null,
    createdAt: now,
    lastTestedAt: null,
    testCount: 0,
    wrongCount: 0,
  };
  assertWordInvariant(word);
  return word;
}

function asStoredWord(word: Word, id: number): StoredWord {
  return { ...word, id };
}

function rethrowRepositoryError(error: unknown, term: string): never {
  if (error instanceof Error && error.name === 'ConstraintError') {
    throw new DuplicateWordError(term);
  }
  throw error;
}

export async function addWord(input: NewWordInput, database: KelimeDatabase = db): Promise<StoredWord> {
  const word = makeNewWord(input);
  try {
    return await database.transaction('rw', database.words, async () => {
      const existing = await database.words.where('normalizedTerm').equals(word.normalizedTerm).first();
      if (existing) throw new DuplicateWordError(input.term.trim());

      const id = await database.words.add(word);
      return asStoredWord(word, id);
    });
  } catch (error) {
    rethrowRepositoryError(error, word.term);
  }
}

export async function addWords(
  inputs: NewWordInput[],
  database: KelimeDatabase = db,
): Promise<BatchAddResult> {
  const result: BatchAddResult = { added: [], duplicates: [], rejected: [] };

  await database.transaction('rw', database.words, async () => {
    const seenInBatch = new Set<string>();

    for (const input of inputs) {
      let word: Word;
      try {
        word = makeNewWord(input);
      } catch (error) {
        result.rejected.push({
          term: input.term,
          reason: error instanceof Error ? error.message : 'Geçersiz kelime.',
        });
        continue;
      }

      const duplicate =
        seenInBatch.has(word.normalizedTerm) ||
        Boolean(await database.words.where('normalizedTerm').equals(word.normalizedTerm).first());
      if (duplicate) {
        result.duplicates.push(input.term.trim());
        continue;
      }

      const id = await database.words.add(word);
      seenInBatch.add(word.normalizedTerm);
      result.added.push(asStoredWord(word, id));
    }
  });

  return result;
}

export async function savePhotoCandidates(
  inputs: PhotoCandidateInput[],
  database: KelimeDatabase = db,
): Promise<PhotoSaveResult> {
  const result: PhotoSaveResult = { addedWords: 0, updatedWords: 0, duplicateWords: 0, totalWords: 0 };

  await database.transaction('rw', database.words, async () => {
    for (const input of inputs) {
      const candidate = makeNewWord(input);
      const existing = (await database.words
        .where('normalizedTerm')
        .equals(candidate.normalizedTerm)
        .first()) as StoredWord | undefined;

      if (!existing) {
        await database.words.add(candidate);
        result.addedWords += 1;
        continue;
      }

      if (!input.appendToExisting) {
        result.duplicateWords += 1;
        continue;
      }

      const meanings = cleanMeanings([...existing.meanings, ...candidate.meanings]);
      if (meanings.length === existing.meanings.length) {
        result.duplicateWords += 1;
        continue;
      }
      await database.words.put({
        ...existing,
        meanings,
        partOfSpeech: existing.partOfSpeech ?? candidate.partOfSpeech,
        exampleEn: existing.exampleEn ?? candidate.exampleEn,
      });
      result.updatedWords += 1;
    }
    result.totalWords = await database.words.count();
  });

  return result;
}

export interface WordChanges {
  term?: string;
  meanings?: string[];
  partOfSpeech?: string;
  exampleEn?: string;
  status?: 'new' | 'tested';
  group?: WordGroup | null;
}

export async function updateWord(
  id: number,
  changes: WordChanges,
  database: KelimeDatabase = db,
): Promise<StoredWord> {
  let attemptedTerm = changes.term?.trim() ?? '';
  try {
    return await database.transaction('rw', database.words, async () => {
      const current = await database.words.get(id);
      if (!current) throw new WordValidationError('Kelime bulunamadı.');

      const next: Word = {
        ...current,
        ...changes,
        term: (changes.term ?? current.term).trim(),
        normalizedTerm: normalizeEn(changes.term ?? current.term),
        meanings: cleanMeanings(changes.meanings ?? current.meanings),
        partOfSpeech: cleanOptional(changes.partOfSpeech ?? current.partOfSpeech),
        exampleEn: cleanOptional(changes.exampleEn ?? current.exampleEn),
        id,
      };
      attemptedTerm = next.term;
      assertWordInvariant(next);

      const duplicate = await database.words.where('normalizedTerm').equals(next.normalizedTerm).first();
      if (duplicate?.id !== undefined && duplicate.id !== id) {
        throw new DuplicateWordError(next.term);
      }

      await database.words.put(next);
      return next as StoredWord;
    });
  } catch (error) {
    rethrowRepositoryError(error, attemptedTerm);
  }
}

export async function deleteWord(id: number, database: KelimeDatabase = db): Promise<void> {
  await database.transaction('rw', database.words, database.attempts, async () => {
    await database.attempts.where('wordId').equals(id).delete();
    await database.words.delete(id);
  });
}

export interface CompleteAttemptInput {
  wordId: number;
  sessionId: string;
  mode: SessionMode;
  pron: Attempt['pron'];
  meaning: Attempt['meaning'];
  invalidRetries: number;
  at?: number;
}

export interface CompleteAttemptResult {
  word: StoredWord;
  attempt: Attempt & { id: number };
}

export async function completeWordAttempt(
  input: CompleteAttemptInput,
  database: KelimeDatabase = db,
): Promise<CompleteAttemptResult> {
  return database.transaction('rw', database.words, database.attempts, async () => {
    const current = await database.words.get(input.wordId) as StoredWord | undefined;
    if (!current) throw new WordValidationError('Test edilen kelime artık bulunamıyor.');
    const at = input.at ?? Date.now();
    const newGroup = groupFromResult(input.pron.correct, input.meaning.correct);
    const attempt: Attempt = {
      wordId: current.id,
      sessionId: input.sessionId,
      mode: input.mode,
      pron: input.pron,
      meaning: input.meaning,
      invalidRetries: Math.max(0, Math.trunc(input.invalidRetries)),
      prevGroup: current.group,
      newGroup,
      at,
    };
    const attemptId = await database.attempts.add(attempt);
    const next: StoredWord = {
      ...current,
      status: 'tested',
      group: newGroup,
      lastTestedAt: at,
      testCount: current.testCount + 1,
      wrongCount: current.wrongCount + (input.pron.correct && input.meaning.correct ? 0 : 1),
    };
    assertWordInvariant(next);
    await database.words.put(next);
    return { word: next, attempt: { ...attempt, id: attemptId } };
  });
}

export async function listWords(database: KelimeDatabase = db): Promise<StoredWord[]> {
  const words = (await database.words.toArray()) as StoredWord[];
  return words.sort((left, right) => right.createdAt - left.createdAt || left.term.localeCompare(right.term));
}

export function observeWords(database: KelimeDatabase = db) {
  return liveQuery(() => listWords(database));
}

export async function clearAllData(database: KelimeDatabase = db): Promise<void> {
  await database.transaction(
    'rw',
    database.words,
    database.attempts,
    database.sessions,
    database.settings,
    async () => {
      await Promise.all([
        database.words.clear(),
        database.attempts.clear(),
        database.sessions.clear(),
        database.settings.clear(),
      ]);
    },
  );
}
