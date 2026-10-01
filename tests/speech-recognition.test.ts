import { describe, expect, it } from 'vitest';

import {
  probeSpeechRecognition,
  recognizeOnce,
  SpeechRecognitionAttemptError,
  type SpeechRecognitionConstructor,
  type SpeechRecognitionLike,
} from '../src/services/speechRecognition';

function recognitionConstructor(
  start: (instance: SpeechRecognitionLike) => void,
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
    stop() { /* test taklidi */ }
    abort() { /* test taklidi */ }
  };
}

describe('Web Speech sarmalayıcısı', () => {
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
    await expect(probeSpeechRecognition({ lang: 'en-US', Recognition: working })).resolves.toEqual({ working: true });
    await expect(probeSpeechRecognition({ lang: 'en-US', Recognition: denied })).resolves.toEqual({
      working: false,
      reason: 'not-allowed',
    });
  });
});
