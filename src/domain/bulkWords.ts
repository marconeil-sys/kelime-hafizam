export interface BulkWordCandidate {
  term: string;
  meanings: string[];
  line: number;
}

export interface BulkParseResult {
  candidates: BulkWordCandidate[];
  errors: Array<{ line: number; text: string; reason: string }>;
}

export function parseBulkWords(text: string): BulkParseResult {
  const result: BulkParseResult = { candidates: [], errors: [] };

  text.split(/\r?\n/u).forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trim();
    if (!line) return;

    const parts = line.split(/\s+(?:-|–|—)\s+|\t+|:\s+/u);
    const term = parts.shift()?.trim() ?? '';
    const meaning = parts.join(' - ').trim();

    if (!term || !meaning) {
      result.errors.push({
        line: lineNumber,
        text: rawLine,
        reason: '“kelime - anlam” biçimi bekleniyor.',
      });
      return;
    }

    result.candidates.push({ term, meanings: [meaning], line: lineNumber });
  });

  return result;
}
