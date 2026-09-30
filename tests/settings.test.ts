import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_JUDGE_MODEL,
  DEFAULT_VISION_MODEL,
  GEMINI_API_KEY,
  getGeminiSettings,
  saveGeminiSettings,
} from '../src/db/settings';
import { KelimeDatabase } from '../src/db/schema';

describe('Gemini ayarları', () => {
  let database: KelimeDatabase;

  beforeEach(() => {
    database = new KelimeDatabase(`settings-test-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    await database.delete();
  });

  it('boş veritabanında güncel varsayılan modelleri kullanır', async () => {
    await expect(getGeminiSettings(database)).resolves.toEqual({
      apiKey: '',
      visionModel: DEFAULT_VISION_MODEL,
      judgeModel: DEFAULT_JUDGE_MODEL,
    });
  });

  it('anahtarı IndexedDB ayarına yazar ve alan boşaltılınca siler', async () => {
    await saveGeminiSettings({
      apiKey: 'device-only-key',
      visionModel: 'vision-custom',
      judgeModel: 'judge-custom',
    }, database);
    await expect(getGeminiSettings(database)).resolves.toEqual({
      apiKey: 'device-only-key',
      visionModel: 'vision-custom',
      judgeModel: 'judge-custom',
    });

    await saveGeminiSettings({
      apiKey: '',
      visionModel: 'vision-custom',
      judgeModel: 'judge-custom',
    }, database);
    expect(await database.settings.get(GEMINI_API_KEY)).toBeUndefined();
  });
});
