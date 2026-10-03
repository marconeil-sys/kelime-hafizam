import { describe, expect, it } from 'vitest';

import { canSaveCard, cardReducer, initialCardState, type CardState } from '../src/features/test/cardMachine';

const pron = { correct: true, heard: 'run', method: 'webspeech' as const, overridden: false };
const meaning = { correct: true, transcript: 'koşmak', method: 'match' as const, overridden: false };

describe('kart durum makinesi', () => {
  it('geçersiz denemeyi sayar ama sonuç ve kayıt üretmez', () => {
    let state = initialCardState(1);
    state = cardReducer(state, { type: 'BEGIN' });
    state = cardReducer(state, { type: 'WORD_SPOKEN' });
    state = cardReducer(state, { type: 'START_PRONUNCIATION' });
    state = cardReducer(state, { type: 'PRONUNCIATION_INVALID', message: 'Ses duyulmadı.' });

    expect(state).toMatchObject({ step: 'pron_prompt', invalidRetries: 1, pronunciation: null });
    expect(canSaveCard(state)).toBe(false);
    expect(cardReducer(state, { type: 'SAVE' }).step).toBe('pron_prompt');
  });

  it('yarıda kalan kartı kaydetme durumuna geçirmez', () => {
    let state = initialCardState(1);
    state = cardReducer(state, { type: 'BEGIN' });
    state = cardReducer(state, { type: 'WORD_SPOKEN' });
    state = cardReducer(state, { type: 'PRONUNCIATION_RESULT', result: pron });
    expect(canSaveCard(state)).toBe(false);
    expect(cardReducer(state, { type: 'SAVE' })).toEqual(state);
  });

  it('iki sonucu aldıktan sonra itirazı işaretler ve kayda geçer', () => {
    let state = initialCardState(1);
    state = cardReducer(state, { type: 'BEGIN' });
    state = cardReducer(state, { type: 'WORD_SPOKEN' });
    state = cardReducer(state, { type: 'PRONUNCIATION_RESULT', result: pron });
    state = cardReducer(state, { type: 'OVERRIDE_PRONUNCIATION' });
    state = cardReducer(state, { type: 'PROMPT_MEANING' });
    state = cardReducer(state, { type: 'MEANING_RESULT', result: meaning });
    expect(state.pronunciation).toMatchObject({ correct: false, overridden: true });
    expect(canSaveCard(state)).toBe(true);
    expect(cardReducer(state, { type: 'SAVE' }).step).toBe('saving');
  });

  it('belirsiz anlamı kullanıcı kararına yönlendirir', () => {
    let state: CardState = {
      ...initialCardState(1),
      step: 'meaning_listening' as const,
      pronunciation: pron,
    };
    state = cardReducer(state, {
      type: 'MEANING_SELF_CHECK',
      transcript: 'garip kayıt',
      message: 'Kararı siz verin.',
    });
    state = cardReducer(state, { type: 'SELF_MEANING_RESULT', correct: false });
    expect(state.meaning).toMatchObject({ correct: false, method: 'self', transcript: 'garip kayıt' });
  });
});
