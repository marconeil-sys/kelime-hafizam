import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  addWord,
  addWords,
  DuplicateWordError,
  completeWordAttempt,
  listWords,
  savePhotoCandidates,
  updateWord,
  WordValidationError,
} from '../src/db/repo';
import { KelimeDatabase } from '../src/db/schema';

describe('kelime deposu', () => {
  let database: KelimeDatabase;

  beforeEach(() => {
    database = new KelimeDatabase(`repo-test-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    await database.delete();
  });

  it('aynı normalize edilmiş kelimeyi ikinci kez eklemez', async () => {
    await addWord({ term: 'To Run.', meanings: ['koşmak'] }, database);

    await expect(addWord({ term: 'run', meanings: ['çalıştırmak'] }, database)).rejects.toBeInstanceOf(
      DuplicateWordError,
    );
    expect(await database.words.count()).toBe(1);
  });

  it('boş anlamı ve yeni durumuyla dolu grubu reddeder', async () => {
    await expect(addWord({ term: 'book', meanings: ['  '] }, database)).rejects.toBeInstanceOf(
      WordValidationError,
    );

    const word = await addWord({ term: 'book', meanings: ['kitap'] }, database);
    await expect(updateWord(word.id, { status: 'new', group: 2 }, database)).rejects.toBeInstanceOf(
      WordValidationError,
    );
  });

  it('toplu eklemeyi tek işlemde yapar ve tekrarları raporlar', async () => {
    const result = await addWords(
      [
        { term: 'reliable', meanings: ['güvenilir'] },
        { term: 'Reliable.', meanings: ['emin'] },
        { term: 'achieve', meanings: ['başarmak'] },
      ],
      database,
    );

    expect(result.added).toHaveLength(2);
    expect(result.duplicates).toEqual(['Reliable.']);
    expect((await listWords(database)).map((word) => word.normalizedTerm).sort()).toEqual([
      'achieve',
      'reliable',
    ]);
  });

  it('eşzamanlı aynı kelime ekleme yarışını DuplicateWordError olarak bildirir', async () => {
    const results = await Promise.allSettled([
      addWord({ term: 'race', meanings: ['yarış'] }, database),
      addWord({ term: 'Race.', meanings: ['yarışmak'] }, database),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected).toMatchObject({ reason: expect.any(DuplicateWordError) });
    expect(await database.words.count()).toBe(1);
  });

  it('fotoğraf adaylarını tek işlemde ekler ve farklı anlamı mevcut kelimeye ekler', async () => {
    await addWord({ term: 'run', meanings: ['koşmak'] }, database);

    const result = await savePhotoCandidates([
      { term: 'walk', meanings: ['yürümek'], appendToExisting: false },
      { term: 'run', meanings: ['çalıştırmak'], appendToExisting: true },
    ], database);

    expect(result).toEqual({ addedWords: 1, updatedWords: 1, duplicateWords: 0, totalWords: 2 });
    const words = await listWords(database);
    expect(words.find((word) => word.normalizedTerm === 'run')?.meanings).toEqual(['koşmak', 'çalıştırmak']);
  });

  it.each([
    [true, true, 1],
    [false, true, 2],
    [true, false, 3],
    [false, false, 4],
  ] as const)('tamamlanan kartı telaffuz=%s anlam=%s için Grup %s yapar', async (pron, meaning, group) => {
    const word = await addWord({ term: `word-${group}`, meanings: ['anlam'] }, database);
    const result = await completeWordAttempt({
      wordId: word.id,
      sessionId: `session-${group}`,
      mode: 'general',
      pron: { correct: pron, heard: word.term, method: 'webspeech', overridden: false },
      meaning: { correct: meaning, transcript: 'anlam', method: 'match', overridden: false },
      invalidRetries: 2,
      at: 10_000 + group,
    }, database);

    expect(result.word).toMatchObject({ status: 'tested', group, testCount: 1 });
    expect(result.word.wrongCount).toBe(group === 1 ? 0 : 1);
    expect(result.attempt).toMatchObject({ prevGroup: null, newGroup: group, invalidRetries: 2 });
    expect(await database.attempts.count()).toBe(1);
  });
});
