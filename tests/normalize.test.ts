import { describe, expect, it } from 'vitest';

import { normalizeEn, normalizeTr } from '../src/domain/normalize';

describe('kelime normalleştirme', () => {
  it('İngilizce başlıkları ve noktalama işaretlerini sadeleştirir', () => {
    expect(normalizeEn('To Run.')).toBe('run');
    expect(normalizeEn('  The   well-known! ')).toBe('well-known');
    expect(normalizeEn('Don’t')).toBe("don't");
  });

  it('Türkçe küçük harf ve ASCII biçimlerini birlikte üretir', () => {
    expect(normalizeTr('İYİ')).toEqual({ locale: 'iyi', ascii: 'iyi' });
    expect(normalizeTr('IŞIK')).toEqual({ locale: 'ışık', ascii: 'isik' });
    expect(normalizeTr('ÇÖZÜM, Şimdi!').ascii).toBe('cozum simdi');
  });
});
