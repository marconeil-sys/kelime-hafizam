import type { PronunciationModePreference } from '../db/settings';
import { selectSupportedAudioMimeType } from './recorder';
import {
  getSpeechRecognitionConstructor,
  probeSpeechRecognition,
  type RecognitionProbeResult,
  type SpeechRecognitionConstructor,
} from './speechRecognition';

export type ActivePronunciationMode = 'webspeech' | 'gemini' | 'manual';

export interface StaticCapabilities {
  textToSpeech: boolean;
  speechRecognition: boolean;
  audioRecording: boolean;
  audioMimeType?: string;
}

export interface CapabilityReport extends StaticCapabilities {
  recognitionProbe: RecognitionProbeResult;
  activeMode: ActivePronunciationMode;
}

export function resolvePronunciationMode(input: {
  preference: PronunciationModePreference;
  recognitionWorking: boolean;
  audioRecording: boolean;
  hasGeminiKey: boolean;
}): ActivePronunciationMode {
  if (input.preference === 'webspeech') return input.recognitionWorking ? 'webspeech' : 'manual';
  if (input.preference === 'gemini') return input.audioRecording && input.hasGeminiKey ? 'gemini' : 'manual';
  if (input.recognitionWorking) return 'webspeech';
  if (input.audioRecording && input.hasGeminiKey) return 'gemini';
  return 'manual';
}

export function detectStaticCapabilities(scope: typeof globalThis = globalThis): StaticCapabilities {
  const navigatorLike = scope.navigator;
  const Recorder = scope.MediaRecorder;
  const audioRecording = Boolean(Recorder && navigatorLike?.mediaDevices?.getUserMedia);
  return {
    textToSpeech: Boolean(scope.speechSynthesis && scope.SpeechSynthesisUtterance),
    speechRecognition: Boolean(getSpeechRecognitionConstructor(scope)),
    audioRecording,
    audioMimeType: Recorder ? selectSupportedAudioMimeType(Recorder) : undefined,
  };
}

export async function detectDeviceCapabilities(input: {
  preference: PronunciationModePreference;
  accent: string;
  hasGeminiKey: boolean;
  Recognition?: SpeechRecognitionConstructor;
  staticCapabilities?: StaticCapabilities;
}): Promise<CapabilityReport> {
  const staticCapabilities = input.staticCapabilities ?? detectStaticCapabilities();
  const Recognition = input.Recognition ?? getSpeechRecognitionConstructor();
  const recognitionProbe = staticCapabilities.speechRecognition
    ? await probeSpeechRecognition({ lang: input.accent, Recognition })
    : { working: false, reason: 'unsupported' } as const;
  return {
    ...staticCapabilities,
    recognitionProbe,
    activeMode: resolvePronunciationMode({
      preference: input.preference,
      recognitionWorking: recognitionProbe.working,
      audioRecording: staticCapabilities.audioRecording,
      hasGeminiKey: input.hasGeminiKey,
    }),
  };
}
