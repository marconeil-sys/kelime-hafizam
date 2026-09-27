import { describe, expect, it } from 'vitest';

import { groupFromResult } from '../src/domain/grouping';

describe('grup kuralı', () => {
  it.each([
    [true, true, 1],
    [false, true, 2],
    [true, false, 3],
    [false, false, 4],
  ] as const)('telaffuz=%s anlam=%s için Grup %s döndürür', (pron, meaning, group) => {
    expect(groupFromResult(pron, meaning)).toBe(group);
  });
});
