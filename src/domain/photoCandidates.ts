import type { StoredWord } from '../db/schema';
import type { VisionItem } from '../services/gemini';
import { normalizeEn, normalizeTr } from './normalize';

export type CandidateKind = 'new' | 'existing' | 'different';
export type MeaningSource = 'page' | 'suggested';

export interface ReviewCandidate {
  id: string;
  term: string;
  meaningText: string;
  source: MeaningSource;
  confidence: number;
  partOfSpeech?: string;
  exampleEn?: string;
  kind: CandidateKind;
  existingWordId?: number;
  selected: boolean;
  appendMeaning: boolean;
}

function uniqueText(values: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const cleaned = value.trim();
    const key = normalizeTr(cleaned).ascii;
    if (!cleaned || seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
  }
  return result;
}

function itemMeanings(item: VisionItem): { meanings: string[]; source: MeaningSource } {
  const onPage = item.meaning_tr_on_page?.trim();
  return onPage
    ? { meanings: [onPage], source: 'page' }
    : { meanings: uniqueText(item.meaning_tr_suggested), source: 'suggested' };
}

export function prepareReviewCandidates(
  items: VisionItem[],
  existingWords: StoredWord[],
): ReviewCandidate[] {
  const merged = new Map<string, {
    term: string;
    meanings: string[];
    source: MeaningSource;
    confidence: number;
    partOfSpeech?: string;
    exampleEn?: string;
  }>();

  for (const item of items) {
    const normalizedTerm = normalizeEn(item.term);
    if (!normalizedTerm) continue;
    const details = itemMeanings(item);
    const current = merged.get(normalizedTerm);
    if (current) {
      if (current.source === details.source) {
        current.meanings = uniqueText([...current.meanings, ...details.meanings]);
      } else if (details.source === 'page') {
        // A printed Turkish meaning always wins over automatic suggestions.
        current.meanings = details.meanings;
        current.source = 'page';
      }
      current.confidence = Math.max(current.confidence, item.confidence);
      current.partOfSpeech ??= item.part_of_speech?.trim() || undefined;
      current.exampleEn ??= item.example_en?.trim() || undefined;
      continue;
    }
    merged.set(normalizedTerm, {
      term: item.term.trim(),
      meanings: details.meanings,
      source: details.source,
      confidence: item.confidence,
      partOfSpeech: item.part_of_speech?.trim() || undefined,
      exampleEn: item.example_en?.trim() || undefined,
    });
  }

  const existingByTerm = new Map(existingWords.map((word) => [word.normalizedTerm, word]));
  return [...merged.entries()].map(([normalizedTerm, candidate]) => {
    const existing = existingByTerm.get(normalizedTerm);
    const existingMeanings = new Set(
      existing ? existing.meanings.map((meaning) => normalizeTr(meaning).ascii) : [],
    );
    const hasDifferentMeaning = Boolean(
      existing && candidate.meanings.some((meaning) => !existingMeanings.has(normalizeTr(meaning).ascii)),
    );
    const kind: CandidateKind = !existing ? 'new' : hasDifferentMeaning ? 'different' : 'existing';
    return {
      id: normalizedTerm,
      term: candidate.term,
      meaningText: candidate.meanings.join('\n'),
      source: candidate.source,
      confidence: candidate.confidence,
      partOfSpeech: candidate.partOfSpeech,
      exampleEn: candidate.exampleEn,
      kind,
      existingWordId: existing?.id,
      selected: kind === 'new' && candidate.meanings.length > 0,
      appendMeaning: false,
    };
  });
}
