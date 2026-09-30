import { describe, expect, it } from 'vitest';

import { prepareReviewCandidates } from '../src/domain/photoCandidates';
import type { StoredWord } from '../src/db/schema';
import type { VisionItem } from '../src/services/gemini';

function storedWord(id: number, term: string, meanings: string[]): StoredWord {
  return {
    id,
    term,
    normalizedTerm: term.toLowerCase(),
    meanings,
    status: 'new',
    group: null,
    createdAt: 1,
    lastTestedAt: null,
    testCount: 0,
    wrongCount: 0,
  };
}

describe('fotoğraf adaylarını hazırlama', () => {
  it('sayfa içi tekrarları birleştirir ve veritabanı durumlarını işaretler', () => {
    const items: VisionItem[] = [
      { term: 'Run', meaning_tr_on_page: 'koşmak', meaning_tr_suggested: ['koşmak'], confidence: 0.6 },
      { term: 'run.', meaning_tr_on_page: 'çalıştırmak', meaning_tr_suggested: ['çalıştırmak'], confidence: 0.9 },
      { term: 'walk', meaning_tr_on_page: null, meaning_tr_suggested: ['yürümek'], confidence: 0.8 },
      { term: 'book', meaning_tr_on_page: 'kitap', meaning_tr_suggested: ['kitap'], confidence: 0.95 },
      { term: 'learn', meaning_tr_suggested: ['öğrenmek', 'bilgi edinmek'], confidence: 0.5 },
      { term: 'learn', meaning_tr_on_page: 'öğrenmek', meaning_tr_suggested: ['öğrenmek'], confidence: 0.7 },
    ];
    const existing = [storedWord(1, 'run', ['koşmak']), storedWord(2, 'book', ['kitap'])];

    const result = prepareReviewCandidates(items, existing);

    expect(result).toHaveLength(4);
    expect(result.find((candidate) => candidate.id === 'run')).toMatchObject({
      kind: 'different',
      meaningText: 'koşmak\nçalıştırmak',
      confidence: 0.9,
      selected: false,
    });
    expect(result.find((candidate) => candidate.id === 'walk')).toMatchObject({ kind: 'new', selected: true });
    expect(result.find((candidate) => candidate.id === 'book')).toMatchObject({ kind: 'existing', selected: false });
    expect(result.find((candidate) => candidate.id === 'learn')).toMatchObject({
      kind: 'new',
      source: 'page',
      meaningText: 'öğrenmek',
    });
  });
});
