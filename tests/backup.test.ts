import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildBackup, restoreBackup } from '../src/db/backup';
import { addWord, listWords, updateWord } from '../src/db/repo';
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

  it('kelime kimliklerini deneme ve oturuma eşler, yeni grubu korur ve ikinci yüklemede çoğaltmaz', async () => {
    await addWord({ term: 'dummy', meanings: ['yer tutucu'] }, target);
    const targetRun = await addWord({ term: 'run', meanings: ['koşmak'] }, target);
    await updateWord(targetRun.id, { status: 'tested', group: 4 }, target);
    await target.words.update(targetRun.id, { lastTestedAt: 100 });

    const sourceRun = await addWord({ term: 'Run.', meanings: ['çalıştırmak'] }, source);
    await updateWord(sourceRun.id, { status: 'tested', group: 2 }, source);
    await source.words.update(sourceRun.id, { lastTestedAt: 200 });
    await source.sessions.put({
      id: 'general-1',
      mode: 'general',
      wordIds: [sourceRun.id],
      doneWordIds: [sourceRun.id],
      status: 'done',
      createdAt: 150,
    });
    await source.attempts.add({
      wordId: sourceRun.id,
      sessionId: 'general-1',
      mode: 'general',
      pron: { correct: false, heard: 'ran', method: 'webspeech', overridden: false },
      meaning: { correct: true, transcript: 'koşmak', method: 'match', overridden: false },
      invalidRetries: 0,
      prevGroup: null,
      newGroup: 2,
      at: 200,
    });

    const backup = await buildBackup(source);
    await restoreBackup(backup, target);
    await restoreBackup(backup, target);

    const restored = await target.words.get(targetRun.id);
    const attempts = await target.attempts.toArray();
    const session = await target.sessions.get('general-1');
    expect(restored).toMatchObject({ group: 2, lastTestedAt: 200 });
    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.wordId).toBe(targetRun.id);
    expect(session?.wordIds).toEqual([targetRun.id]);
    expect(session?.doneWordIds).toEqual([targetRun.id]);
  });
});
