import { describe, expect, it } from 'vitest';

import { meaningMatch, meaningVariants } from '../src/domain/meaningMatch';

describe('Türkçe anlam eşleştirme', () => {
  it.each(['koşmak', 'koşuyor', 'kosmak'])('“%s” cevabını koşmak ile eşleştirir', (answer) => {
    expect(meaningMatch([answer], ['koşmak']).correct).toBe(true);
  });

  it('yanlış anlamı reddeder', () => {
    expect(meaningMatch(['yürümek'], ['koşmak']).correct).toBe(false);
    expect(meaningMatch(['saat'], ['at']).correct).toBe(false);
  });

  it('virgül, noktalı virgül, eğik çizgi ve parantez açıklamasını varyantlara ayırır', () => {
    expect(meaningVariants(['koşmak, çalıştırmak; işletmek / akmak (sıvı)'])).toEqual([
      'koşmak', 'çalıştırmak', 'işletmek', 'akmak',
    ]);
    expect(meaningMatch(['işletmek'], ['koşmak, çalıştırmak; işletmek']).correct).toBe(true);
  });
});
