import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildBackup, restoreBackup } from '../src/db/backup';
import { addWord, listWords } from '../src/db/repo';
import { KelimeDatabase } from '../src/db/schema';

describe('yedekleme', () => {
  let source: KelimeDatabase;
  let target: KelimeDatabase;

  beforeEach(() => {
    source = new KelimeDatabase(`backup-source-${crypto.randomUUID()}`);
    target = new KelimeDatabase(`backup-target-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    await source.delete();
    await target.delete();
  });

  it('API anahtarını yedeğe yazmaz', async () => {
    await source.settings.bulkPut([
      { key: 'geminiApiKey', value: 'AIza-test-secret' },
      { key: 'accent', value: 'en-US' },
    ]);

    const backup = await buildBackup(source);

    expect(JSON.stringify(backup)).not.toContain('AIza-test-secret');
    expect(backup.settings).toEqual([{ key: 'accent', value: 'en-US' }]);
  });

  it('aynı kelimenin anlamlarını birleştirir ve tekrar geri yüklemede çoğaltmaz', async () => {
    await addWord({ term: 'run', meanings: ['koşmak'] }, source);
    await addWord({ term: 'Run.', meanings: ['çalıştırmak'] }, target);
    const backup = await buildBackup(source);

    const first = await restoreBackup(backup, target);
    const second = await restoreBackup(backup, target);
    const words = await listWords(target);

    expect(first).toMatchObject({ addedWords: 0, mergedWords: 1 });
    expect(second).toMatchObject({ addedWords: 0, mergedWords: 1 });
    expect(words).toHaveLength(1);
    expect(words[0]?.meanings).toEqual(['çalıştırmak', 'koşmak']);
  });
});
