import { db, type KelimeDatabase } from './schema';

export const GEMINI_API_KEY = 'geminiApiKey';
export const VISION_MODEL_KEY = 'visionModel';
export const JUDGE_MODEL_KEY = 'judgeModel';

export const DEFAULT_VISION_MODEL = 'gemini-3.8-flash';
export const DEFAULT_JUDGE_MODEL = 'gemini-3.5-flash-lite';

export interface GeminiSettings {
  apiKey: string;
  visionModel: string;
  judgeModel: string;
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export async function getGeminiSettings(database: KelimeDatabase = db): Promise<GeminiSettings> {
  const settings = await database.settings.bulkGet([
    GEMINI_API_KEY,
    VISION_MODEL_KEY,
    JUDGE_MODEL_KEY,
  ]);
  return {
    apiKey: stringValue(settings[0]?.value),
    visionModel: stringValue(settings[1]?.value, DEFAULT_VISION_MODEL),
    judgeModel: stringValue(settings[2]?.value, DEFAULT_JUDGE_MODEL),
  };
}

export async function saveGeminiSettings(
  settings: GeminiSettings,
  database: KelimeDatabase = db,
): Promise<void> {
  const apiKey = settings.apiKey.trim();
  const visionModel = settings.visionModel.trim();
  const judgeModel = settings.judgeModel.trim();
  if (!visionModel || !judgeModel) throw new Error('Model adları boş bırakılamaz.');

  await database.transaction('rw', database.settings, async () => {
    if (apiKey) {
      await database.settings.put({ key: GEMINI_API_KEY, value: apiKey });
    } else {
      await database.settings.delete(GEMINI_API_KEY);
    }
    await database.settings.bulkPut([
      { key: VISION_MODEL_KEY, value: visionModel },
      { key: JUDGE_MODEL_KEY, value: judgeModel },
    ]);
  });
}
