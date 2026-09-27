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
});
