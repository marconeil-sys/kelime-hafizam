export interface VoiceOption {
  name: string;
  lang: string;
  voiceURI: string;
  localService: boolean;
}

interface SpeechSynthesisLike {
  getVoices: () => SpeechSynthesisVoice[];
  speak: (utterance: SpeechSynthesisUtterance) => void;
  cancel: () => void;
  speaking?: boolean;
  pending?: boolean;
  addEventListener?: (type: string, listener: EventListener) => void;
  removeEventListener?: (type: string, listener: EventListener) => void;
}

export class TextToSpeechError extends Error {
  constructor(message = 'Bu cihazda seslendirme başlatılamadı.') {
    super(message);
    this.name = 'TextToSpeechError';
  }
}

export function estimateSpeechDurationMs(text: string, rate = 1): number {
  const words = text.trim().split(/\s+/u).filter(Boolean).length;
  const punctuationPauses = (text.match(/[,.!?;:]/gu) ?? []).length * 120;
  return Math.max(450, Math.round((words * 430 + punctuationPauses) / Math.max(0.5, rate)));
}

export function chooseVoice(
  voices: readonly SpeechSynthesisVoice[],
  lang: string,
  preferredVoiceURI = '',
): SpeechSynthesisVoice | undefined {
  const preferred = voices.find((voice) => voice.voiceURI === preferredVoiceURI);
  if (preferred) return preferred;
  const normalizedLanguage = lang.toLowerCase();
  return voices.find((voice) => voice.lang.toLowerCase() === normalizedLanguage)
    ?? voices.find((voice) => voice.lang.toLowerCase().startsWith(normalizedLanguage.split('-')[0]!));
}

export async function listSpeechVoices(
  synth: SpeechSynthesisLike | undefined = globalThis.speechSynthesis,
  waitMs = 800,
): Promise<VoiceOption[]> {
  if (!synth) return [];
  let voices = synth.getVoices();
  if (voices.length === 0 && synth.addEventListener) {
    voices = await new Promise<SpeechSynthesisVoice[]>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        synth.removeEventListener?.('voiceschanged', handleVoicesChanged);
        window.clearTimeout(timer);
        resolve(synth.getVoices());
      };
      const handleVoicesChanged: EventListener = () => finish();
      const timer = window.setTimeout(finish, waitMs);
      synth.addEventListener?.('voiceschanged', handleVoicesChanged);
    });
  }
  return voices.map((voice) => ({
    name: voice.name,
    lang: voice.lang,
    voiceURI: voice.voiceURI,
    localService: voice.localService,
  }));
}

export async function speakText(input: {
  text: string;
  lang: string;
  voiceURI?: string;
  rate?: number;
  pitch?: number;
  signal?: AbortSignal;
  synth?: SpeechSynthesisLike;
  createUtterance?: (text: string) => SpeechSynthesisUtterance;
}): Promise<'end' | 'timeout'> {
  const synth = input.synth ?? globalThis.speechSynthesis;
  const createUtterance = input.createUtterance
    ?? ((text: string) => new SpeechSynthesisUtterance(text));
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined' && !input.createUtterance) {
    throw new TextToSpeechError('Bu cihaz seslendirmeyi desteklemiyor.');
  }
  if (input.signal?.aborted) throw new DOMException('Seslendirme iptal edildi.', 'AbortError');

  const utterance = createUtterance(input.text);
  utterance.lang = input.lang;
  utterance.rate = input.rate ?? 0.92;
  utterance.pitch = input.pitch ?? 1;
  utterance.voice = chooseVoice(synth.getVoices(), input.lang, input.voiceURI) ?? null;

  return new Promise((resolve, reject) => {
    let settled = false;
    let startupTimer: number | undefined;
    let playbackTimer: number | undefined;
    const clearTimers = () => {
      if (startupTimer !== undefined) window.clearTimeout(startupTimer);
      if (playbackTimer !== undefined) window.clearTimeout(playbackTimer);
    };
    const cancelIfActive = () => {
      if (synth.speaking || synth.pending) synth.cancel();
    };
    const finish = (result: 'end' | 'timeout') => {
      if (settled) return;
      settled = true;
      clearTimers();
      input.signal?.removeEventListener('abort', handleAbort);
      resolve(result);
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      clearTimers();
      input.signal?.removeEventListener('abort', handleAbort);
      reject(new TextToSpeechError());
    };
    const handleAbort = () => {
      if (settled) return;
      settled = true;
      clearTimers();
      cancelIfActive();
      reject(new DOMException('Seslendirme iptal edildi.', 'AbortError'));
    };
    startupTimer = window.setTimeout(
      () => {
        finish('timeout');
      },
      4_000,
    );
    utterance.onstart = () => {
      if (settled) return;
      if (startupTimer !== undefined) window.clearTimeout(startupTimer);
      playbackTimer = window.setTimeout(() => {
        finish('timeout');
        cancelIfActive();
      }, estimateSpeechDurationMs(input.text, utterance.rate) + 1_500);
    };
    utterance.onend = () => finish('end');
    utterance.onerror = () => fail();
    input.signal?.addEventListener('abort', handleAbort, { once: true });
    try {
      cancelIfActive();
      synth.speak(utterance);
    } catch {
      fail();
    }
  });
}
