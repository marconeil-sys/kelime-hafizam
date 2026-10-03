import { db, type KelimeDatabase } from './schema';

export const GEMINI_API_KEY = 'geminiApiKey';
export const VISION_MODEL_KEY = 'visionModel';
export const JUDGE_MODEL_KEY = 'judgeModel';
export const ACCENT_KEY = 'accent';
export const ENGLISH_VOICE_KEY = 'englishVoiceURI';
export const TURKISH_VOICE_KEY = 'turkishVoiceURI';
export const SPOKEN_FEEDBACK_KEY = 'spokenFeedback';
export const PRONUNCIATION_MODE_KEY = 'pronunciationMode';
export const AUTO_ADVANCE_KEY = 'autoAdvance';
export const CAPABILITY_REPORT_KEY = 'capabilityReport';

export const DEFAULT_VISION_MODEL = 'gemini-3.8-flash';
export const DEFAULT_JUDGE_MODEL = 'gemini-3.5-flash-lite';

export interface GeminiSettings {
  apiKey: string;
  visionModel: string;
  judgeModel: string;
}

export type EnglishAccent = 'en-US' | 'en-GB';
export type PronunciationModePreference = 'auto' | 'webspeech' | 'gemini';

export interface AudioSettings {
  accent: EnglishAccent;
  englishVoiceURI: string;
  turkishVoiceURI: string;
  spokenFeedback: boolean;
  pronunciationMode: PronunciationModePreference;
  autoAdvance: boolean;
}

export type SavedPronunciationMode = 'webspeech' | 'gemini' | 'manual';

export interface SavedCapabilityReport {
  activeMode: SavedPronunciationMode;
  reason: string;
  accent: EnglishAccent;
  testedAt: number;
  textToSpeech: boolean;
  audioRecording: boolean;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  accent: 'en-US',
  englishVoiceURI: '',
  turkishVoiceURI: '',
  spokenFeedback: true,
  pronunciationMode: 'auto',
  autoAdvance: true,
};

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

export async function getAudioSettings(database: KelimeDatabase = db): Promise<AudioSettings> {
  const settings = await database.settings.bulkGet([
    ACCENT_KEY,
    ENGLISH_VOICE_KEY,
    TURKISH_VOICE_KEY,
    SPOKEN_FEEDBACK_KEY,
    PRONUNCIATION_MODE_KEY,
    AUTO_ADVANCE_KEY,
  ]);
  const accent = settings[0]?.value;
  const pronunciationMode = settings[4]?.value;
  return {
    accent: accent === 'en-GB' ? 'en-GB' : 'en-US',
    englishVoiceURI: stringValue(settings[1]?.value),
    turkishVoiceURI: stringValue(settings[2]?.value),
    spokenFeedback: typeof settings[3]?.value === 'boolean'
      ? settings[3].value
      : DEFAULT_AUDIO_SETTINGS.spokenFeedback,
    pronunciationMode: pronunciationMode === 'webspeech' || pronunciationMode === 'gemini'
      ? pronunciationMode
      : 'auto',
    autoAdvance: typeof settings[5]?.value === 'boolean'
      ? settings[5].value
      : DEFAULT_AUDIO_SETTINGS.autoAdvance,
  };
}

export async function saveAudioSettings(
  settings: AudioSettings,
  database: KelimeDatabase = db,
): Promise<void> {
  await database.settings.bulkPut([
    { key: ACCENT_KEY, value: settings.accent === 'en-GB' ? 'en-GB' : 'en-US' },
    { key: ENGLISH_VOICE_KEY, value: settings.englishVoiceURI.trim() },
    { key: TURKISH_VOICE_KEY, value: settings.turkishVoiceURI.trim() },
    { key: SPOKEN_FEEDBACK_KEY, value: settings.spokenFeedback },
    {
      key: PRONUNCIATION_MODE_KEY,
      value: ['auto', 'webspeech', 'gemini'].includes(settings.pronunciationMode)
        ? settings.pronunciationMode
        : 'auto',
    },
    { key: AUTO_ADVANCE_KEY, value: settings.autoAdvance },
  ]);
}

export async function getSavedCapabilityReport(
  database: KelimeDatabase = db,
): Promise<SavedCapabilityReport | null> {
  const setting = await database.settings.get(CAPABILITY_REPORT_KEY);
  const value = setting?.value;
  if (typeof value !== 'object' || value === null) return null;
  const report = value as Partial<SavedCapabilityReport>;
  if (
    !['webspeech', 'gemini', 'manual'].includes(String(report.activeMode)) ||
    typeof report.reason !== 'string' ||
    (report.accent !== 'en-US' && report.accent !== 'en-GB') ||
    typeof report.testedAt !== 'number' ||
    !Number.isFinite(report.testedAt) ||
    typeof report.textToSpeech !== 'boolean' ||
    typeof report.audioRecording !== 'boolean'
  ) return null;
  return report as SavedCapabilityReport;
}

export async function saveCapabilityReport(
  report: SavedCapabilityReport,
  database: KelimeDatabase = db,
): Promise<void> {
  await database.settings.put({ key: CAPABILITY_REPORT_KEY, value: report });
}
