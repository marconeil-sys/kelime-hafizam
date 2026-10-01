import { afterEach, describe, expect, it, vi } from 'vitest';

import { chooseVoice, estimateSpeechDurationMs, speakText } from '../src/services/tts';

function voice(input: Partial<SpeechSynthesisVoice> & Pick<SpeechSynthesisVoice, 'name' | 'lang' | 'voiceURI'>) {
  return {
    default: false,
    localService: true,
    ...input,
  } as SpeechSynthesisVoice;
}

describe('metin seslendirme', () => {
  afterEach(() => vi.useRealTimers());

  it('önce kayıtlı sesi, yoksa istenen dildeki sesi seçer', () => {
    const voices = [
      voice({ name: 'English US', lang: 'en-US', voiceURI: 'us' }),
      voice({ name: 'English UK', lang: 'en-GB', voiceURI: 'uk' }),
    ];
    expect(chooseVoice(voices, 'en-US', 'uk')?.voiceURI).toBe('uk');
    expect(chooseVoice(voices, 'en-US')?.voiceURI).toBe('us');
  });

  it('onend gelince beklemeyi bitirir', async () => {
    const utterance = { onend: null, onerror: null } as unknown as SpeechSynthesisUtterance;
    const synth = {
      getVoices: () => [],
      cancel: vi.fn(),
      speak: vi.fn(() => utterance.onend?.call(utterance, new Event('end') as SpeechSynthesisEvent)),
    };
    await expect(speakText({
      text: 'example',
      lang: 'en-US',
      synth,
      createUtterance: () => utterance,
    })).resolves.toBe('end');
  });

  it('iOS onend göndermese bile tahmini süre + 1,5 saniyede çözülür', async () => {
    vi.useFakeTimers();
    const utterance = { onend: null, onerror: null } as unknown as SpeechSynthesisUtterance;
    const promise = speakText({
      text: 'example',
      lang: 'en-US',
      synth: { getVoices: () => [], cancel: vi.fn(), speak: vi.fn() },
      createUtterance: () => utterance,
    });
    await vi.advanceTimersByTimeAsync(estimateSpeechDurationMs('example', 0.92) + 1_500);
    await expect(promise).resolves.toBe('timeout');
  });
});
