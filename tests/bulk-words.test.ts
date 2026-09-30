import { describe, expect, it } from 'vitest';

import { parseBulkWords } from '../src/domain/bulkWords';

describe('toplu kelime ayrıştırma', () => {
  it('geçerli satırları çıkarır ve hatalı satırı bildirir', () => {
    const result = parseBulkWords('achieve - başarmak\nbozuk satır\nreliable\tgüvenilir');

    expect(result.candidates).toEqual([
      { term: 'achieve', meanings: ['başarmak'], line: 1 },
      { term: 'reliable', meanings: ['güvenilir'], line: 3 },
    ]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.line).toBe(2);
  });

  it('numaralı ve madde işaretli satırları temizler, kelimenin kendi sayısını korur', () => {
    const result = parseBulkWords(
      '1. run - koşmak\n12) walk - yürümek\n(3) go - gitmek\n- get up - kalkmak\n• look up - aramak\n2-way - iki yönlü',
    );

    expect(result.errors).toEqual([]);
    expect(result.candidates.map((candidate) => candidate.term)).toEqual([
      'run',
      'walk',
      'go',
      'get up',
      'look up',
      '2-way',
    ]);
  });
});
