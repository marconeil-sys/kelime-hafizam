import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  addWord,
  addWords,
  DuplicateWordError,
  listWords,
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
});
