import { normalizeEn } from '../domain/normalize';
import { assertWordInvariant, cleanMeanings } from './repo';
import {
  db,
  type Attempt,
  type KelimeDatabase,
  type Session,
  type Setting,
  type StoredWord,
  type Word,
  type WordGroup,
} from './schema';

export const BACKUP_KIND = 'kelime-hafizam-backup';
export const BACKUP_VERSION = 1;
export const LAST_BACKUP_AT_KEY = 'lastBackupAt';

export interface BackupV1 {
  kind: typeof BACKUP_KIND;
  version: typeof BACKUP_VERSION;
  exportedAt: number;
  words: Word[];
  attempts: Attempt[];
  sessions: Session[];
  settings: Setting[];
}

export interface RestoreResult {
  addedWords: number;
  mergedWords: number;
  addedAttempts: number;
  mergedSessions: number;
}

export class InvalidBackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidBackupError';
  }
}

export function isSecretSettingKey(key: string): boolean {
  const normalized = key.toLocaleLowerCase('en-US').replace(/[-_\s]/gu, '');
  return normalized.includes('apikey') || normalized.includes('geminikey');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isGroup(value: unknown): value is WordGroup {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

function isWord(value: unknown): value is Word {
  if (!isRecord(value)) return false;
  const validGroup = value.group === null || isGroup(value.group);
  const validStatus = value.status === 'new' || value.status === 'tested';
  return (
    typeof value.term === 'string' &&
    Array.isArray(value.meanings) &&
    value.meanings.every((meaning) => typeof meaning === 'string') &&
    validStatus &&
    validGroup &&
    typeof value.createdAt === 'number' &&
    Number.isFinite(value.createdAt) &&
    (value.lastTestedAt === null ||
      (typeof value.lastTestedAt === 'number' && Number.isFinite(value.lastTestedAt))) &&
    typeof value.testCount === 'number' &&
    Number.isFinite(value.testCount) &&
    value.testCount >= 0 &&
    typeof value.wrongCount === 'number' &&
    Number.isFinite(value.wrongCount) &&
    value.wrongCount >= 0
  );
}

function isAttempt(value: unknown): value is Attempt {
  if (!isRecord(value) || !isRecord(value.pron) || !isRecord(value.meaning)) return false;
  return (
    typeof value.wordId === 'number' &&
    typeof value.sessionId === 'string' &&
    (value.mode === 'general' || value.mode === 'daily' || value.mode === 'mastered') &&
    typeof value.pron.correct === 'boolean' &&
    typeof value.pron.heard === 'string' &&
    (value.pron.method === 'webspeech' || value.pron.method === 'gemini' || value.pron.method === 'self') &&
    typeof value.pron.overridden === 'boolean' &&
    typeof value.meaning.correct === 'boolean' &&
    typeof value.meaning.transcript === 'string' &&
    (value.meaning.method === 'match' || value.meaning.method === 'gemini' || value.meaning.method === 'self') &&
    typeof value.meaning.overridden === 'boolean' &&
    typeof value.invalidRetries === 'number' &&
    Number.isFinite(value.invalidRetries) &&
    value.invalidRetries >= 0 &&
    isGroup(value.newGroup) &&
    (value.prevGroup === null || isGroup(value.prevGroup)) &&
    typeof value.at === 'number' &&
    Number.isFinite(value.at)
  );
}

function isSession(value: unknown): value is Session {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    (value.mode === 'general' || value.mode === 'daily' || value.mode === 'mastered') &&
    Array.isArray(value.wordIds) &&
    value.wordIds.every((id) => typeof id === 'number') &&
    Array.isArray(value.doneWordIds) &&
    value.doneWordIds.every((id) => typeof id === 'number') &&
    (value.status === 'active' || value.status === 'done') &&
    typeof value.createdAt === 'number' &&
    Number.isFinite(value.createdAt) &&
    (value.dailyDate === undefined || typeof value.dailyDate === 'string')
  );
}

function isSetting(value: unknown): value is Setting {
  return isRecord(value) && typeof value.key === 'string' && 'value' in value;
}

export function parseBackup(value: string | unknown): BackupV1 {
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      throw new InvalidBackupError('Dosya geçerli JSON içermiyor.');
    }
  }

  if (
    !isRecord(parsed) ||
    parsed.kind !== BACKUP_KIND ||
    parsed.version !== BACKUP_VERSION ||
    typeof parsed.exportedAt !== 'number' ||
    !Array.isArray(parsed.words) ||
    !parsed.words.every(isWord) ||
    !Array.isArray(parsed.attempts) ||
    !parsed.attempts.every(isAttempt) ||
    !Array.isArray(parsed.sessions) ||
    !parsed.sessions.every(isSession) ||
    !Array.isArray(parsed.settings) ||
    !parsed.settings.every(isSetting)
  ) {
    throw new InvalidBackupError('Bu dosya desteklenen bir Kelime Hafızam yedeği değil.');
  }

  return parsed as unknown as BackupV1;
}

export async function buildBackup(database: KelimeDatabase = db): Promise<BackupV1> {
  const [words, attempts, sessions, settings] = await Promise.all([
    database.words.toArray(),
    database.attempts.toArray(),
    database.sessions.toArray(),
    database.settings.toArray(),
  ]);

  return {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    words,
    attempts,
    sessions,
    settings: settings.filter((setting) => !isSecretSettingKey(setting.key)),
  };
}

export function backupFileName(date = new Date()): string {
  const day = date.toISOString().slice(0, 10);
  return `kelime-hafizam-yedek-${day}.json`;
}

export async function recordBackupCreated(database: KelimeDatabase = db): Promise<void> {
  await database.settings.put({ key: LAST_BACKUP_AT_KEY, value: Date.now() });
}

export async function getLastBackupAt(database: KelimeDatabase = db): Promise<number | null> {
  const setting = await database.settings.get(LAST_BACKUP_AT_KEY);
  return typeof setting?.value === 'number' ? setting.value : null;
}

function mergeMeanings(left: string[], right: string[]): string[] {
  return cleanMeanings([...left, ...right]);
}

function normalizeImportedWord(word: Word): Word {
  const normalized: Word = {
    ...word,
    id: undefined,
    term: word.term.trim(),
    normalizedTerm: normalizeEn(word.term),
    meanings: cleanMeanings(word.meanings),
    partOfSpeech: word.partOfSpeech?.trim() || undefined,
    exampleEn: word.exampleEn?.trim() || undefined,
    testCount: Math.max(0, Math.trunc(word.testCount)),
    wrongCount: Math.max(0, Math.trunc(word.wrongCount)),
  };
  assertWordInvariant(normalized);
  return normalized;
}

function newerState(imported: Word, existing: Word): Pick<Word, 'status' | 'group' | 'lastTestedAt'> {
  const importedAt = imported.lastTestedAt ?? -1;
  const existingAt = existing.lastTestedAt ?? -1;
  return importedAt > existingAt
    ? { status: imported.status, group: imported.group, lastTestedAt: imported.lastTestedAt }
    : { status: existing.status, group: existing.group, lastTestedAt: existing.lastTestedAt };
}

export async function restoreBackup(
  source: string | unknown,
  database: KelimeDatabase = db,
): Promise<RestoreResult> {
  const backup = parseBackup(source);
  const result: RestoreResult = { addedWords: 0, mergedWords: 0, addedAttempts: 0, mergedSessions: 0 };

  await database.transaction(
    'rw',
    database.words,
    database.attempts,
    database.sessions,
    database.settings,
    async () => {
      const idMap = new Map<number, number>();

      for (const rawWord of backup.words) {
        const imported = normalizeImportedWord(rawWord);
        const existing = (await database.words
          .where('normalizedTerm')
          .equals(imported.normalizedTerm)
          .first()) as StoredWord | undefined;

        if (existing) {
          const state = newerState(imported, existing);
          const merged: StoredWord = {
            ...existing,
            ...state,
            meanings: mergeMeanings(existing.meanings, imported.meanings),
            partOfSpeech: existing.partOfSpeech ?? imported.partOfSpeech,
            exampleEn: existing.exampleEn ?? imported.exampleEn,
            createdAt: Math.min(existing.createdAt, imported.createdAt),
            testCount: Math.max(existing.testCount, imported.testCount),
            wrongCount: Math.max(existing.wrongCount, imported.wrongCount),
          };
          assertWordInvariant(merged);
          await database.words.put(merged);
          if (typeof rawWord.id === 'number') idMap.set(rawWord.id, existing.id);
          result.mergedWords += 1;
          continue;
        }

        const id = await database.words.add(imported);
        if (typeof rawWord.id === 'number') idMap.set(rawWord.id, id);
        result.addedWords += 1;
      }

      const existingAttempts = await database.attempts.toArray();
      const attemptKeys = new Set(
        existingAttempts.map((attempt) => `${attempt.sessionId}:${attempt.wordId}:${attempt.at}`),
      );
      for (const attempt of backup.attempts) {
        const mappedWordId = idMap.get(attempt.wordId);
        if (!mappedWordId) continue;
        const key = `${attempt.sessionId}:${mappedWordId}:${attempt.at}`;
        if (attemptKeys.has(key)) continue;
        const { id: _discardedId, ...withoutId } = attempt;
        await database.attempts.add({ ...withoutId, wordId: mappedWordId });
        attemptKeys.add(key);
        result.addedAttempts += 1;
      }

      for (const session of backup.sessions) {
        const mapped: Session = {
          ...session,
          wordIds: session.wordIds.flatMap((id) => (idMap.has(id) ? [idMap.get(id)!] : [])),
          doneWordIds: session.doneWordIds.flatMap((id) => (idMap.has(id) ? [idMap.get(id)!] : [])),
        };
        const existing = await database.sessions.get(session.id);
        if (existing) {
          mapped.wordIds = [...new Set([...existing.wordIds, ...mapped.wordIds])];
          mapped.doneWordIds = [...new Set([...existing.doneWordIds, ...mapped.doneWordIds])];
          mapped.status = existing.status === 'done' || mapped.status === 'done' ? 'done' : 'active';
        }
        await database.sessions.put(mapped);
        result.mergedSessions += 1;
      }

      for (const setting of backup.settings) {
        if (!isSecretSettingKey(setting.key)) await database.settings.put(setting);
      }
    },
  );

  return result;
}
