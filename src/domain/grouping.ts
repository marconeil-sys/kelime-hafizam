import type { WordGroup } from '../db/schema';

export function groupFromResult(pronunciationCorrect: boolean, meaningCorrect: boolean): WordGroup {
  if (pronunciationCorrect && meaningCorrect) return 1;
  if (!pronunciationCorrect && meaningCorrect) return 2;
  if (pronunciationCorrect && !meaningCorrect) return 3;
  return 4;
}
