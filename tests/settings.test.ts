import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_JUDGE_MODEL,
  DEFAULT_AUDIO_SETTINGS,
  DEFAULT_VISION_MODEL,
  GEMINI_API_KEY,
  getGeminiSettings,
  getAudioSettings,
  saveAudioSettings,
  getSavedCapabilityReport,
  saveCapabilityReport,
  saveGeminiSettings,
} from '../src/db/settings';
import { KelimeDatabase } from '../src/db/schema';
import { isPreparedBackupFresh, PREPARED_BACKUP_LIFETIME_MS } from '../src/features/settings/BackupPanel';

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

describe('ses ayarları', () => {
  let database: KelimeDatabase;

  beforeEach(() => {
    database = new KelimeDatabase(`audio-settings-test-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    await database.delete();
  });

  it('varsayılanları okur ve cihaz tercihlerini kaydeder', async () => {
    await expect(getAudioSettings(database)).resolves.toEqual(DEFAULT_AUDIO_SETTINGS);
    const settings = {
      accent: 'en-GB' as const,
      englishVoiceURI: 'english-voice',
      turkishVoiceURI: 'turkish-voice',
      spokenFeedback: false,
      pronunciationMode: 'gemini' as const,
      autoAdvance: false,
    };
    await saveAudioSettings(settings, database);
    await expect(getAudioSettings(database)).resolves.toEqual(settings);
  });

  it('son cihaz testi sonucunu sonraki oturum için saklar', async () => {
    expect(await getSavedCapabilityReport(database)).toBeNull();
    const report = {
      activeMode: 'gemini' as const,
      reason: 'timeout',
      accent: 'en-US' as const,
      testedAt: 123_456,
      textToSpeech: true,
      audioRecording: true,
    };
    await saveCapabilityReport(report, database);
    await expect(getSavedCapabilityReport(database)).resolves.toEqual(report);
  });
});

describe('hazırlanmış yedek geçerliliği', () => {
  it('kelime sayısı değiştiğinde veya beş dakika geçtiğinde yedeği bayat sayar', () => {
    const prepared = { wordCount: 12, createdAt: 1_000 };
    expect(isPreparedBackupFresh(prepared, 12, 1_000 + PREPARED_BACKUP_LIFETIME_MS - 1)).toBe(true);
    expect(isPreparedBackupFresh(prepared, 13, 1_001)).toBe(false);
    expect(isPreparedBackupFresh(prepared, 12, 1_000 + PREPARED_BACKUP_LIFETIME_MS)).toBe(false);
  });
});
