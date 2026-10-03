import type { Attempt } from '../../db/schema';

export type CardStep =
  | 'ready'
  | 'speaking_word'
  | 'pron_prompt'
  | 'pron_listening'
  | 'pron_feedback'
  | 'meaning_prompt'
  | 'meaning_listening'
  | 'meaning_self_check'
  | 'meaning_feedback'
  | 'saving'
  | 'saved';

export type PronunciationEvaluation = Attempt['pron'] & {
  near?: boolean;
  feedback?: string;
};

export type MeaningEvaluation = Attempt['meaning'] & {
  reason?: string;
  isNewValidMeaning?: boolean;
};

export interface CardState {
  wordId: number;
  step: CardStep;
  pronunciation: PronunciationEvaluation | null;
  meaning: MeaningEvaluation | null;
  pendingMeaningTranscript: string;
  invalidRetries: number;
  notice: string;
}

export type CardEvent =
  | { type: 'BEGIN' }
  | { type: 'WORD_SPOKEN' }
  | { type: 'START_PRONUNCIATION' }
  | { type: 'PRONUNCIATION_INVALID'; message: string }
  | { type: 'PRONUNCIATION_RESULT'; result: PronunciationEvaluation }
  | { type: 'OVERRIDE_PRONUNCIATION' }
  | { type: 'PROMPT_MEANING' }
  | { type: 'START_MEANING' }
  | { type: 'MEANING_INVALID'; message: string }
  | { type: 'MEANING_SELF_CHECK'; transcript: string; message: string }
  | { type: 'MEANING_RESULT'; result: MeaningEvaluation }
  | { type: 'SELF_MEANING_RESULT'; correct: boolean }
  | { type: 'OVERRIDE_MEANING' }
  | { type: 'SAVE' }
  | { type: 'SAVE_FAILED'; message: string }
  | { type: 'SAVED' }
  | { type: 'RESET'; wordId: number };

export function initialCardState(wordId: number): CardState {
  return {
    wordId,
    step: 'ready',
    pronunciation: null,
    meaning: null,
    pendingMeaningTranscript: '',
    invalidRetries: 0,
    notice: '',
  };
}

export function canSaveCard(state: CardState): boolean {
  return Boolean(state.pronunciation && state.meaning && state.step === 'meaning_feedback');
}

export function cardReducer(state: CardState, event: CardEvent): CardState {
  switch (event.type) {
    case 'BEGIN':
      return state.step === 'ready' ? { ...state, step: 'speaking_word', notice: '' } : state;
    case 'WORD_SPOKEN':
      return state.step === 'speaking_word' ? { ...state, step: 'pron_prompt' } : state;
    case 'START_PRONUNCIATION':
      return state.step === 'pron_prompt' ? { ...state, step: 'pron_listening', notice: '' } : state;
    case 'PRONUNCIATION_INVALID':
      return state.step === 'pron_listening'
        ? { ...state, step: 'pron_prompt', invalidRetries: state.invalidRetries + 1, notice: event.message }
        : state;
    case 'PRONUNCIATION_RESULT':
      return state.step === 'pron_listening' || state.step === 'pron_prompt'
        ? { ...state, step: 'pron_feedback', pronunciation: event.result, notice: '' }
        : state;
    case 'OVERRIDE_PRONUNCIATION':
      return state.pronunciation && ['pron_feedback', 'meaning_prompt', 'meaning_feedback'].includes(state.step)
        ? {
          ...state,
          pronunciation: {
            ...state.pronunciation,
            correct: !state.pronunciation.correct,
            overridden: true,
          },
        }
        : state;
    case 'PROMPT_MEANING':
      return state.step === 'pron_feedback' ? { ...state, step: 'meaning_prompt', notice: '' } : state;
    case 'START_MEANING':
      return state.step === 'meaning_prompt' ? { ...state, step: 'meaning_listening', notice: '' } : state;
    case 'MEANING_INVALID':
      return state.step === 'meaning_listening'
        ? { ...state, step: 'meaning_prompt', invalidRetries: state.invalidRetries + 1, notice: event.message }
        : state;
    case 'MEANING_SELF_CHECK':
      return state.step === 'meaning_listening'
        ? {
          ...state,
          step: 'meaning_self_check',
          pendingMeaningTranscript: event.transcript,
          notice: event.message,
        }
        : state;
    case 'SELF_MEANING_RESULT':
      return state.step === 'meaning_self_check'
        ? {
          ...state,
          step: 'meaning_feedback',
          meaning: {
            correct: event.correct,
            transcript: state.pendingMeaningTranscript,
            method: 'self',
            overridden: false,
          },
          notice: '',
        }
        : state;
    case 'MEANING_RESULT':
      return state.step === 'meaning_listening' || state.step === 'meaning_prompt'
        ? { ...state, step: 'meaning_feedback', meaning: event.result, notice: '' }
        : state;
    case 'OVERRIDE_MEANING':
      return state.meaning && state.step === 'meaning_feedback'
        ? {
          ...state,
          meaning: { ...state.meaning, correct: !state.meaning.correct, overridden: true },
        }
        : state;
    case 'SAVE':
      return canSaveCard(state) ? { ...state, step: 'saving', notice: '' } : state;
    case 'SAVE_FAILED':
      return state.step === 'saving' ? { ...state, step: 'meaning_feedback', notice: event.message } : state;
    case 'SAVED':
      return state.step === 'saving' ? { ...state, step: 'saved' } : state;
    case 'RESET':
      return initialCardState(event.wordId);
    default:
      return state;
  }
}
