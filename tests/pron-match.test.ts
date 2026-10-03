import { describe, expect, it } from 'vitest';

import { pronunciationMatch } from '../src/domain/pronMatch';

describe('telaffuz metni eşleştirme', () => {
  it('alternatiflerden biri hedefse doğru kabul eder', () => {
    expect(pronunciationMatch(['ran', 'run'], 'run')).toMatchObject({ correct: true, heard: 'run' });
  });

  it('sayı sözcüğü ile rakamı eşdeğer sayar', () => {
    expect(pronunciationMatch(['two'], '2').correct).toBe(true);
  });

  it('0,8 benzerliği yakın ama yanlış olarak ayırır', () => {
    const result = pronunciationMatch(['exampl'], 'example');
    expect(result.correct).toBe(false);
    expect(result.near).toBe(true);
  });
});
