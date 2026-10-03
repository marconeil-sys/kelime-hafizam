import { levenshteinSimilarity } from './levenshtein';
import { normalizeEn } from './normalize';
import { canonicalizeNumberWords } from './numberWords';

export interface PronunciationMatch {
  correct: boolean;
  near: boolean;
  heard: string;
  similarity: number;
}

function canonical(value: string): string {
  return canonicalizeNumberWords(normalizeEn(value));
}

export function pronunciationMatch(
  transcripts: readonly string[],
  target: string,
): PronunciationMatch {
  const expected = canonical(target);
  let best: PronunciationMatch = { correct: false, near: false, heard: '', similarity: 0 };

  for (const transcript of transcripts) {
    const heard = canonical(transcript);
    if (!heard) continue;
    if (heard === expected) return { correct: true, near: false, heard: transcript.trim(), similarity: 1 };
    const similarity = levenshteinSimilarity(heard, expected);
    if (similarity > best.similarity) {
      best = {
        correct: false,
        near: similarity >= 0.8,
        heard: transcript.trim(),
        similarity,
      };
    }
  }
  return best;
}
