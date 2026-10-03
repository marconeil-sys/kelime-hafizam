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

  it('onstart hiç gelmezse dört saniyede timeout olur', async () => {
    vi.useFakeTimers();
    const utterance = { onend: null, onerror: null } as unknown as SpeechSynthesisUtterance;
    const promise = speakText({
      text: 'example',
      lang: 'en-US',
      synth: { getVoices: () => [], cancel: vi.fn(), speak: vi.fn() },
      createUtterance: () => utterance,
    });
    await vi.advanceTimersByTimeAsync(4_000);
    await expect(promise).resolves.toBe('timeout');
  });

  it('gecikmeli onstart sonrasında sesi başlangıç zaman aşımında kesmez', async () => {
    vi.useFakeTimers();
    const utterance = { onstart: null, onend: null, onerror: null } as unknown as SpeechSynthesisUtterance;
    const synth = {
      getVoices: () => [],
      cancel: vi.fn(),
      speaking: false,
      pending: false,
      speak: vi.fn(() => {
        window.setTimeout(() => utterance.onstart?.call(utterance, new Event('start') as SpeechSynthesisEvent), 1_800);
        window.setTimeout(() => utterance.onend?.call(utterance, new Event('end') as SpeechSynthesisEvent), 2_600);
      }),
    };
    const promise = speakText({
      text: 'example',
      lang: 'en-US',
      synth,
      createUtterance: () => utterance,
    });

    await vi.advanceTimersByTimeAsync(2_600);
    await expect(promise).resolves.toBe('end');
    expect(synth.cancel).not.toHaveBeenCalled();
    expect(estimateSpeechDurationMs('example', 0.92)).toBeGreaterThan(0);
  });

  it('onstart sonrası güvenlik süresi dolarsa yalnız aktif konuşmayı durdurur', async () => {
    vi.useFakeTimers();
    const utterance = { onstart: null, onend: null, onerror: null } as unknown as SpeechSynthesisUtterance;
    const synth = {
      getVoices: () => [],
      cancel: vi.fn(),
      speaking: true,
      pending: false,
      speak: vi.fn(() => utterance.onstart?.call(utterance, new Event('start') as SpeechSynthesisEvent)),
    };
    const promise = speakText({
      text: 'example',
      lang: 'en-US',
      synth,
      createUtterance: () => utterance,
    });
    await vi.advanceTimersByTimeAsync(estimateSpeechDurationMs('example', 0.92) + 1_500);
    await expect(promise).resolves.toBe('timeout');
    expect(synth.cancel).toHaveBeenCalled();
  });
});
