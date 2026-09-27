import { useEffect, useMemo, useState } from 'react';

import { deleteWord, observeWords } from '../../db/repo';
import type { StoredWord, WordGroup } from '../../db/schema';
import { normalizeEn, normalizeTr } from '../../domain/normalize';
import { WordEdit } from './WordEdit';

type Filter = 'all' | 'new' | WordGroup;

const filters: Array<{ label: string; value: Filter; tone: string }> = [
  { label: 'Tümü', value: 'all', tone: 'all' },
  { label: 'Yeni', value: 'new', tone: 'new' },
  { label: 'Grup 1', value: 1, tone: 'g1' },
  { label: 'Grup 2', value: 2, tone: 'g2' },
  { label: 'Grup 3', value: 3, tone: 'g3' },
  { label: 'Grup 4', value: 4, tone: 'g4' },
];

function matchesFilter(word: StoredWord, filter: Filter): boolean {
  if (filter === 'all') return true;
  if (filter === 'new') return word.status === 'new';
  return word.group === filter;
}

export function WordList() {
  const [words, setWords] = useState<StoredWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => {
    const subscription = observeWords().subscribe({
      next(nextWords) {
        setWords(nextWords);
        setLoading(false);
      },
      error(caught) {
        setError(caught instanceof Error ? caught.message : 'Kelime listesi okunamadı.');
        setLoading(false);
      },
    });
    return () => subscription.unsubscribe();
  }, []);

  const counts = useMemo(
    () => ({
      new: words.filter((word) => word.status === 'new').length,
      1: words.filter((word) => word.group === 1).length,
      2: words.filter((word) => word.group === 2).length,
      3: words.filter((word) => word.group === 3).length,
      4: words.filter((word) => word.group === 4).length,
    }),
    [words],
  );

  const visibleWords = useMemo(() => {
    const enQuery = normalizeEn(query);
    const trQuery = normalizeTr(query).ascii;
    return words.filter((word) => {
      if (!matchesFilter(word, filter)) return false;
      if (!query.trim()) return true;
      return (
        word.normalizedTerm.includes(enQuery) ||
        word.meanings.some((meaning) => normalizeTr(meaning).ascii.includes(trQuery))
      );
    });
  }, [filter, query, words]);

  async function handleDelete(word: StoredWord) {
    if (!window.confirm(`“${word.term}” kelimesi silinsin mi?`)) return;
    try {
      await deleteWord(word.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Kelime silinemedi.');
    }
  }

  return (
    <section aria-labelledby="words-title">
      <div className="section-heading">
        <p className="eyebrow">Yerel kelime havuzu</p>
        <h2 id="words-title">Kelimelerim</h2>
        <p>Kelimelerin ve ilerleme grupların yalnız bu cihazda saklanır.</p>
      </div>

      <div className="group-grid" aria-label="Kelime grup sayaçları">
        {filters.slice(1).map((item) => (
          <button
            key={item.label}
            type="button"
            className={`group-stat group-stat--${item.tone}${filter === item.value ? ' is-selected' : ''}`}
            onClick={() => setFilter(filter === item.value ? 'all' : item.value)}
            aria-pressed={filter === item.value}
          >
            <strong>{counts[item.value as keyof typeof counts]}</strong>
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <label className="search-field">
        <span className="sr-only">Kelime ara</span>
        <span aria-hidden="true">⌕</span>
        <input
          type="search"
          placeholder="İngilizce veya Türkçe ara"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      {filter !== 'all' ? (
        <button className="filter-clear" type="button" onClick={() => setFilter('all')}>
          Filtreyi temizle
        </button>
      ) : null}

      {error ? <p className="form-message form-message--error">{error}</p> : null}
      {loading ? <p className="loading-copy">Kelimeler yükleniyor…</p> : null}

      {!loading && visibleWords.length === 0 ? (
        <div className="empty-state empty-state--compact">
          <span className="empty-state__icon" aria-hidden="true">Aa</span>
          <h3>{words.length === 0 ? 'Listen henüz boş' : 'Eşleşen kelime yok'}</h3>
          <p>
            {words.length === 0
              ? 'Ekle sekmesinden tek tek veya toplu olarak kelime ekleyebilirsin.'
              : 'Arama metnini ya da grup filtresini değiştir.'}
          </p>
        </div>
      ) : null}

      <div className="word-list">
        {visibleWords.map((word) => (
          <article className="word-card" key={word.id}>
            <div className="word-card__heading">
              <div>
                <span className={`group-chip group-chip--${word.group ?? 'new'}`}>
                  {word.group ? `Grup ${word.group}` : 'Yeni'}
                </span>
                <h3>{word.term}</h3>
              </div>
              <div className="word-actions">
                <button type="button" onClick={() => setEditingId(word.id)} aria-label={`${word.term} düzenle`}>
                  Düzenle
                </button>
                <button
                  className="danger-link"
                  type="button"
                  onClick={() => void handleDelete(word)}
                  aria-label={`${word.term} sil`}
                >
                  Sil
                </button>
              </div>
            </div>
            <p className="word-meanings">{word.meanings.join(' · ')}</p>
            {editingId === word.id ? <WordEdit word={word} onClose={() => setEditingId(null)} /> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
