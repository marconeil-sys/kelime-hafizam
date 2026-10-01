export const AUDIO_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/mp4',
  'audio/aac',
] as const;

type MediaRecorderConstructor = typeof MediaRecorder;
type AudioContextConstructor = typeof AudioContext;

export interface RecordedAudio {
  blob: Blob;
  mimeType: string;
  durationMs: number;
  averageLevel: number;
  isSilent: boolean;
}

export class AudioRecorderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AudioRecorderError';
  }
}

export function selectSupportedAudioMimeType(
  Recorder: Pick<MediaRecorderConstructor, 'isTypeSupported'> | undefined = globalThis.MediaRecorder,
): string | undefined {
  if (!Recorder?.isTypeSupported) return undefined;
  return AUDIO_MIME_CANDIDATES.find((mimeType) => Recorder.isTypeSupported(mimeType));
}

export function rootMeanSquareFromTimeDomain(values: Uint8Array): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const value of values) {
    const normalized = (value - 128) / 128;
    sum += normalized * normalized;
  }
  return Math.sqrt(sum / values.length);
}

function defaultAudioContextConstructor(): AudioContextConstructor | undefined {
  const scope = globalThis as typeof globalThis & { webkitAudioContext?: AudioContextConstructor };
  return scope.AudioContext ?? scope.webkitAudioContext;
}

export async function recordAudioClip(input: {
  maxDurationMs?: number;
  silenceThreshold?: number;
  signal?: AbortSignal;
  getUserMedia?: () => Promise<MediaStream>;
  Recorder?: MediaRecorderConstructor;
  AudioContextClass?: AudioContextConstructor;
} = {}): Promise<RecordedAudio> {
  const Recorder = input.Recorder ?? globalThis.MediaRecorder;
  const getUserMedia = input.getUserMedia
    ?? (() => navigator.mediaDevices.getUserMedia({ audio: true }));
  if (!Recorder || !navigator.mediaDevices && !input.getUserMedia) {
    throw new AudioRecorderError('Bu cihaz ses kaydını desteklemiyor.');
  }
  if (input.signal?.aborted) throw new DOMException('Kayıt iptal edildi.', 'AbortError');

  let stream: MediaStream;
  try {
    stream = await getUserMedia();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotAllowedError') {
      throw new AudioRecorderError('Mikrofon izni verilmedi. Tarayıcı ayarlarından izin verin.');
    }
    throw new AudioRecorderError('Mikrofona erişilemedi.');
  }

  const mimeType = selectSupportedAudioMimeType(Recorder);
  const recorder = new Recorder(stream, mimeType ? { mimeType } : undefined);
  const AudioContextClass = input.AudioContextClass ?? defaultAudioContextConstructor();
  let audioContext: AudioContext | undefined;
  let source: MediaStreamAudioSourceNode | undefined;
  let analyser: AnalyserNode | undefined;
  if (AudioContextClass) {
    try {
      audioContext = new AudioContextClass();
      source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 1_024;
      source.connect(analyser);
    } catch {
      analyser = undefined;
    }
  }

  return new Promise((resolve, reject) => {
    const chunks: Blob[] = [];
    const levels: number[] = [];
    const startedAt = Date.now();
    let settled = false;
    const levelBuffer = analyser ? new Uint8Array(analyser.fftSize) : undefined;
    const sampleTimer = analyser && levelBuffer
      ? window.setInterval(() => {
        analyser.getByteTimeDomainData(levelBuffer);
        levels.push(rootMeanSquareFromTimeDomain(levelBuffer));
      }, 50)
      : undefined;
    const stopTimer = window.setTimeout(() => {
      if (recorder.state !== 'inactive') recorder.stop();
    }, input.maxDurationMs ?? 4_000);

    const cleanup = () => {
      window.clearTimeout(stopTimer);
      if (sampleTimer !== undefined) window.clearInterval(sampleTimer);
      input.signal?.removeEventListener('abort', handleAbort);
      stream.getTracks().forEach((track) => track.stop());
      try { source?.disconnect(); } catch { /* zaten ayrılmış olabilir */ }
      if (audioContext && audioContext.state !== 'closed') void audioContext.close();
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const handleAbort = () => {
      if (recorder.state !== 'inactive') recorder.stop();
      fail(new DOMException('Kayıt iptal edildi.', 'AbortError'));
    };

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = () => fail(new AudioRecorderError('Ses kaydı tamamlanamadı.'));
    recorder.onstop = () => {
      if (settled) return;
      settled = true;
      const averageLevel = levels.length > 0
        ? levels.reduce((total, level) => total + level, 0) / levels.length
        : 1;
      const actualMimeType = recorder.mimeType || mimeType || 'application/octet-stream';
      cleanup();
      resolve({
        blob: new Blob(chunks, { type: actualMimeType }),
        mimeType: actualMimeType,
        durationMs: Date.now() - startedAt,
        averageLevel,
        isSilent: levels.length > 0 && averageLevel < (input.silenceThreshold ?? 0.012),
      });
    };
    input.signal?.addEventListener('abort', handleAbort, { once: true });
    try {
      recorder.start(250);
    } catch {
      fail(new AudioRecorderError('Ses kaydı başlatılamadı.'));
    }
  });
}
