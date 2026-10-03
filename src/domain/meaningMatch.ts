import { levenshteinSimilarity } from './levenshtein';
import { normalizeTr } from './normalize';

export type MeaningMatchKind = 'exact' | 'similar' | 'stem' | 'none';

export interface MeaningMatchResult {
  correct: boolean;
  kind: MeaningMatchKind;
  transcript: string;
  acceptedMeaning: string;
  similarity: number;
}

export function meaningVariants(meanings: readonly string[]): string[] {
  const seen = new Set<string>();
  return meanings.flatMap((meaning) => meaning
    .replace(/\([^)]*\)/gu, ' ')
    .split(/[,;/]/u))
    .map((meaning) => meaning.trim())
    .filter((meaning) => {
      const key = normalizeTr(meaning).ascii;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function stemOf(value: string): string | null {
  const normalized = normalizeTr(value).ascii;
  if (!/m(?:a|e)k$/u.test(normalized)) return null;
  const stem = normalized.slice(0, -3);
  return stem.length >= 3 ? stem : null;
}

function containsPhrase(text: string, phrase: string): boolean {
  return ` ${text} `.includes(` ${phrase} `);
}

export function meaningMatch(
  transcripts: readonly string[],
  meanings: readonly string[],
): MeaningMatchResult {
  const variants = meaningVariants(meanings);
  let best: MeaningMatchResult = {
    correct: false,
    kind: 'none',
    transcript: transcripts[0]?.trim() ?? '',
    acceptedMeaning: '',
    similarity: 0,
  };

  for (const rawTranscript of transcripts) {
    const transcript = normalizeTr(rawTranscript);
    if (!transcript.ascii) continue;
    const words = transcript.ascii.split(' ');
    for (const variant of variants) {
      const accepted = normalizeTr(variant);
      if (
        transcript.locale === accepted.locale ||
        transcript.ascii === accepted.ascii ||
        containsPhrase(transcript.locale, accepted.locale) ||
        containsPhrase(transcript.ascii, accepted.ascii)
      ) {
        return {
          correct: true,
          kind: 'exact',
          transcript: rawTranscript.trim(),
          acceptedMeaning: variant,
          similarity: 1,
        };
      }

      const similarity = Math.max(
        levenshteinSimilarity(transcript.locale, accepted.locale),
        levenshteinSimilarity(transcript.ascii, accepted.ascii),
      );
      if (similarity >= 0.85) {
        return {
          correct: true,
          kind: 'similar',
          transcript: rawTranscript.trim(),
          acceptedMeaning: variant,
          similarity,
        };
      }

      const stem = stemOf(variant);
      if (stem && words.some((word) => word.startsWith(stem))) {
        return {
          correct: true,
          kind: 'stem',
          transcript: rawTranscript.trim(),
          acceptedMeaning: variant,
          similarity,
        };
      }

      if (similarity > best.similarity) {
        best = {
          correct: false,
          kind: 'none',
          transcript: rawTranscript.trim(),
          acceptedMeaning: variant,
          similarity,
        };
      }
    }
  }
  return best;
}
