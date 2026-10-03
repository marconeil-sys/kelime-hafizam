export interface SpeechAlternative {
  transcript: string;
  confidence: number;
}

export type SpeechRecognitionErrorCode =
  | 'no-speech'
  | 'aborted'
  | 'audio-capture'
  | 'network'
  | 'not-allowed'
  | 'service-not-allowed'
  | 'bad-grammar'
  | 'language-not-supported'
  | 'unknown';

interface RecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

interface RecognitionResultLike {
  length: number;
  [index: number]: RecognitionAlternativeLike;
}

interface RecognitionEventLike {
  results: { length: number; [index: number]: RecognitionResultLike };
}

interface RecognitionErrorEventLike {
  error?: string;
}

export interface SpeechRecognitionLike {
  lang: string;
  maxAlternatives: number;
  interimResults: boolean;
  continuous: boolean;
  onstart: (() => void) | null;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: ((event: RecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export class SpeechRecognitionAttemptError extends Error {
  readonly code: SpeechRecognitionErrorCode;

  constructor(code: SpeechRecognitionErrorCode) {
    const messages: Record<SpeechRecognitionErrorCode, string> = {
      'no-speech': 'Ses duyulmadı. Tekrar deneyin.',
      aborted: 'Dinleme iptal edildi.',
      'audio-capture': 'Mikrofona erişilemedi.',
      network: 'Konuşma tanıma için ağ bağlantısı kurulamadı.',
      'not-allowed': 'Mikrofon izni verilmedi.',
      'service-not-allowed': 'Konuşma tanıma servisine izin verilmedi.',
      'bad-grammar': 'Konuşma tanıma yapılandırması geçersiz.',
      'language-not-supported': 'Seçilen dil bu cihazda desteklenmiyor.',
      unknown: 'Konuşma tanıma tamamlanamadı.',
    };
    super(messages[code]);
    this.name = 'SpeechRecognitionAttemptError';
    this.code = code;
  }
}

export function getSpeechRecognitionConstructor(
  scope: unknown = globalThis,
): SpeechRecognitionConstructor | undefined {
  const candidate = scope as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return candidate.SpeechRecognition ?? candidate.webkitSpeechRecognition;
}

function asErrorCode(error: string | undefined): SpeechRecognitionErrorCode {
  const known: SpeechRecognitionErrorCode[] = [
    'no-speech', 'aborted', 'audio-capture', 'network', 'not-allowed',
    'service-not-allowed', 'bad-grammar', 'language-not-supported',
  ];
  return known.includes(error as SpeechRecognitionErrorCode)
    ? error as SpeechRecognitionErrorCode
    : 'unknown';
}

export function recognizeOnce(input: {
  lang: string;
  maxDurationMs?: number;
  maxAlternatives?: number;
  signal?: AbortSignal;
  Recognition?: SpeechRecognitionConstructor;
}): Promise<SpeechAlternative[]> {
  const Constructor = input.Recognition ?? getSpeechRecognitionConstructor();
  if (!Constructor) return Promise.reject(new SpeechRecognitionAttemptError('service-not-allowed'));
  if (input.signal?.aborted) return Promise.reject(new DOMException('Dinleme iptal edildi.', 'AbortError'));

  return new Promise((resolve, reject) => {
    const recognition = new Constructor();
    let settled = false;
    let listeningTimer: number | undefined;
    let resultGraceTimer: number | undefined;
    const cleanup = () => {
      if (listeningTimer !== undefined) window.clearTimeout(listeningTimer);
      if (resultGraceTimer !== undefined) window.clearTimeout(resultGraceTimer);
      input.signal?.removeEventListener('abort', handleAbort);
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
    };
    const finishError = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const handleAbort = () => {
      recognition.abort();
      finishError(new DOMException('Dinleme iptal edildi.', 'AbortError'));
    };

    recognition.lang = input.lang;
    recognition.maxAlternatives = input.maxAlternatives ?? 5;
    recognition.interimResults = false;
    recognition.continuous = false;
    const startTimeout = () => {
      if (listeningTimer !== undefined) window.clearTimeout(listeningTimer);
      listeningTimer = window.setTimeout(() => {
        recognition.stop();
        resultGraceTimer = window.setTimeout(
          () => finishError(new SpeechRecognitionAttemptError('no-speech')),
          1_000,
        );
      }, input.maxDurationMs ?? 5_000);
    };
    recognition.onstart = startTimeout;
    recognition.onresult = (event) => {
      const result = event.results[0];
      const alternatives = result
        ? Array.from({ length: result.length }, (_, index) => result[index])
          .filter((alternative): alternative is RecognitionAlternativeLike => Boolean(alternative?.transcript?.trim()))
          .map((alternative) => ({
            transcript: alternative.transcript.trim(),
            confidence: Number.isFinite(alternative.confidence) ? alternative.confidence : 0,
          }))
        : [];
      if (alternatives.length === 0) {
        finishError(new SpeechRecognitionAttemptError('no-speech'));
        return;
      }
      if (settled) return;
      settled = true;
      cleanup();
      recognition.stop();
      resolve(alternatives);
    };
    recognition.onerror = (event) => finishError(new SpeechRecognitionAttemptError(asErrorCode(event.error)));
    recognition.onend = () => finishError(new SpeechRecognitionAttemptError('no-speech'));
    input.signal?.addEventListener('abort', handleAbort, { once: true });
    startTimeout();
    try {
      recognition.start();
    } catch {
      finishError(new SpeechRecognitionAttemptError('not-allowed'));
    }
  });
}

export interface RecognitionProbeResult {
  working: boolean;
  reason?: SpeechRecognitionErrorCode | 'unsupported' | 'timeout';
}

export function probeSpeechRecognition(input: {
  lang: string;
  timeoutMs?: number;
  stabilityMs?: number;
  Recognition?: SpeechRecognitionConstructor;
}): Promise<RecognitionProbeResult> {
  const Constructor = input.Recognition ?? getSpeechRecognitionConstructor();
  if (!Constructor) return Promise.resolve({ working: false, reason: 'unsupported' });

  return new Promise((resolve) => {
    const recognition = new Constructor();
    let settled = false;
    let started = false;
    let stabilityTimer: number | undefined;
    const finish = (result: RecognitionProbeResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(startupTimer);
      if (stabilityTimer !== undefined) window.clearTimeout(stabilityTimer);
      recognition.onstart = null;
      recognition.onerror = null;
      recognition.onend = null;
      try { recognition.abort(); } catch { /* bazı tarayıcılar başlamadan abort çağrısını reddeder */ }
      resolve(result);
    };
    recognition.lang = input.lang;
    recognition.maxAlternatives = 5;
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () => {
      started = true;
      window.clearTimeout(startupTimer);
      stabilityTimer = window.setTimeout(
        () => finish({ working: true }),
        input.stabilityMs ?? 1_000,
      );
    };
    recognition.onerror = (event) => {
      const reason = asErrorCode(event.error);
      finish(reason === 'no-speech' ? { working: true } : { working: false, reason });
    };
    recognition.onend = () => finish(started
      ? { working: true }
      : { working: false, reason: 'unknown' });
    const startupTimer = window.setTimeout(
      () => finish({ working: false, reason: 'timeout' }),
      input.timeoutMs ?? 6_000,
    );
    try {
      recognition.start();
    } catch {
      finish({ working: false, reason: 'not-allowed' });
    }
  });
}
