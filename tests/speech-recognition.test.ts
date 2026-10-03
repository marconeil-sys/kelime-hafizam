import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  probeSpeechRecognition,
  recognizeOnce,
  SpeechRecognitionAttemptError,
  type SpeechRecognitionConstructor,
  type SpeechRecognitionLike,
} from '../src/services/speechRecognition';

function recognitionConstructor(
  start: (instance: SpeechRecognitionLike) => void,
  stop: (instance: SpeechRecognitionLike) => void = () => undefined,
): SpeechRecognitionConstructor {
  return class FakeRecognition implements SpeechRecognitionLike {
    lang = '';
    maxAlternatives = 0;
    interimResults = true;
    continuous = true;
    onstart: (() => void) | null = null;
    onresult: SpeechRecognitionLike['onresult'] = null;
    onerror: SpeechRecognitionLike['onerror'] = null;
    onend: (() => void) | null = null;
    start() { start(this); }
    stop() { stop(this); }
    abort() { /* test taklidi */ }
  };
}

describe('Web Speech sarmalayıcısı', () => {
  afterEach(() => vi.useRealTimers());
  it('dili ve beş alternatifi ayarlayıp sonuçları döndürür', async () => {
    let configured: SpeechRecognitionLike | undefined;
    const Constructor = recognitionConstructor((instance) => {
      configured = instance;
      instance.onstart?.();
      instance.onresult?.({
        results: {
          0: {
            0: { transcript: ' example ', confidence: 0.91 },
            1: { transcript: 'sample', confidence: 0.2 },
            length: 2,
          },
          length: 1,
        },
      });
    });
    await expect(recognizeOnce({ lang: 'en-GB', Recognition: Constructor })).resolves.toEqual([
      { transcript: 'example', confidence: 0.91 },
      { transcript: 'sample', confidence: 0.2 },
    ]);
    expect(configured).toMatchObject({
      lang: 'en-GB',
      maxAlternatives: 5,
      interimResults: false,
      continuous: false,
    });
  });

  it('no-speech hatasını geçersiz deneme olarak ayırır', async () => {
    const Constructor = recognitionConstructor((instance) => instance.onerror?.({ error: 'no-speech' }));
    await expect(recognizeOnce({ lang: 'en-US', Recognition: Constructor })).rejects.toMatchObject({
      code: 'no-speech',
    } satisfies Partial<SpeechRecognitionAttemptError>);
  });

  it('başlatılabilen motoru çalışıyor, izin reddini çalışmıyor sayar', async () => {
    const working = recognitionConstructor((instance) => instance.onstart?.());
    const denied = recognitionConstructor((instance) => instance.onerror?.({ error: 'not-allowed' }));
    await expect(probeSpeechRecognition({ lang: 'en-US', Recognition: working, stabilityMs: 0 })).resolves.toEqual({ working: true });
    await expect(probeSpeechRecognition({ lang: 'en-US', Recognition: denied })).resolves.toEqual({
      working: false,
      reason: 'not-allowed',
    });
  });

  it('altı saniyelik sonda geç başlayan motoru kabul eder', async () => {
    vi.useFakeTimers();
    const late = recognitionConstructor((instance) => {
      window.setTimeout(() => instance.onstart?.(), 2_000);
    });
    const promise = probeSpeechRecognition({ lang: 'en-US', Recognition: late });
    await vi.advanceTimersByTimeAsync(3_000);
    await expect(promise).resolves.toEqual({ working: true });
  });

  it('onstart sonrasındaki service-not-allowed hatasını yakalar', async () => {
    vi.useFakeTimers();
    const rejected = recognitionConstructor((instance) => {
      instance.onstart?.();
      window.setTimeout(() => instance.onerror?.({ error: 'service-not-allowed' }), 100);
    });
    const promise = probeSpeechRecognition({ lang: 'en-US', Recognition: rejected });
    await vi.advanceTimersByTimeAsync(100);
    await expect(promise).resolves.toEqual({ working: false, reason: 'service-not-allowed' });
  });

  it('dinleme sınırında stop sonrası gelen son sonucu bir saniye bekler', async () => {
    vi.useFakeTimers();
    const Constructor = recognitionConstructor(
      (instance) => instance.onstart?.(),
      (instance) => window.setTimeout(() => instance.onresult?.({
        results: {
          0: { 0: { transcript: 'last second', confidence: 0.8 }, length: 1 },
          length: 1,
        },
      }), 200),
    );
    const promise = recognizeOnce({ lang: 'en-US', Recognition: Constructor, maxDurationMs: 1_000 });
    await vi.advanceTimersByTimeAsync(1_200);
    await expect(promise).resolves.toEqual([{ transcript: 'last second', confidence: 0.8 }]);
  });
});
