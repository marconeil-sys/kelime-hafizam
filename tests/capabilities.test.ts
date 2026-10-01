import { describe, expect, it } from 'vitest';

import { resolvePronunciationMode } from '../src/services/capabilities';

describe('telaffuz modu seçimi', () => {
  it('otomatik modda çalışan Web Speech için Mod A seçer', () => {
    expect(resolvePronunciationMode({
      preference: 'auto',
      recognitionWorking: true,
      audioRecording: true,
      hasGeminiKey: true,
    })).toBe('webspeech');
  });

  it('Web Speech çalışmıyorsa kayıt ve anahtarla Mod B seçer', () => {
    expect(resolvePronunciationMode({
      preference: 'auto',
      recognitionWorking: false,
      audioRecording: true,
      hasGeminiKey: true,
    })).toBe('gemini');
  });

  it('hiçbir otomatik yöntem hazır değilse elle moda düşer', () => {
    expect(resolvePronunciationMode({
      preference: 'auto',
      recognitionWorking: false,
      audioRecording: true,
      hasGeminiKey: false,
    })).toBe('manual');
  });
});
