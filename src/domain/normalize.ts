const EDGE_PUNCTUATION = /^[\s\p{P}\p{S}]+|[\s\p{P}\p{S}]+$/gu;
const TURKISH_PUNCTUATION = /[\p{P}\p{S}]+/gu;

export function normalizeEn(value: string): string {
  let normalized = value
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replaceAll('’', "'")
    .replace(EDGE_PUNCTUATION, '')
    .replace(/\s+/g, ' ')
    .trim();

  normalized = normalized.replace(/^(?:to|a|an|the)\s+/u, '');
  return normalized.replace(EDGE_PUNCTUATION, '').trim();
}

export function foldTurkishToAscii(value: string): string {
  return value
    .replaceAll('ç', 'c')
    .replaceAll('ğ', 'g')
    .replaceAll('ı', 'i')
    .replaceAll('ö', 'o')
    .replaceAll('ş', 's')
    .replaceAll('ü', 'u');
}

export interface NormalizedTurkish {
  locale: string;
  ascii: string;
}

export function normalizeTr(value: string): NormalizedTurkish {
  const locale = value
    .normalize('NFKC')
    .toLocaleLowerCase('tr-TR')
    .replace(TURKISH_PUNCTUATION, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return { locale, ascii: foldTurkishToAscii(locale) };
}
