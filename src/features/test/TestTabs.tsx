import { liveQuery } from 'dexie';
import { useEffect, useMemo, useState } from 'react';

import { listWords } from '../../db/repo';
import type { SessionMode, StoredWord } from '../../db/schema';
import { SessionRunner } from './SessionRunner';

const modes: Array<{ mode: SessionMode; label: string; detail: string }> = [
  { mode: 'general', label: 'Genel Tarama', detail: 'Yeni kelimeler ve Grup 2–4' },
  { mode: 'daily', label: 'Günlük Tarama', detail: 'Grup 2–4 çalışma havuzu' },
  { mode: 'mastered', label: 'Ezberlediklerim', detail: 'Yalnız Grup 1 kelimeleri' },
];

export function poolForMode(words: StoredWord[], mode: SessionMode): StoredWord[] {
  if (mode === 'mastered') return words.filter((word) => word.group === 1);
  if (mode === 'daily') return words.filter((word) => word.group === 2 || word.group === 3 || word.group === 4);
  return words.filter((word) => word.status === 'new' || word.group !== 1);
}

export function TestTabs() {
  const [words, setWords] = useState<StoredWord[]>([]);
  const [selectedMode, setSelectedMode] = useState<SessionMode>('general');
  const [sessionWords, setSessionWords] = useState<StoredWord[] | null>(null);

  useEffect(() => {
    const subscription = liveQuery(() => listWords()).subscribe({
      next: setWords,
      error: () => setWords([]),
    });
    return () => subscription.unsubscribe();
  }, []);

  const pool = useMemo(() => poolForMode(words, selectedMode), [words, selectedMode]);

  if (sessionWords) {
    return <SessionRunner words={sessionWords} mode={selectedMode} onExit={() => setSessionWords(null)} />;
  }

  const emptyMessage = selectedMode === 'general'
    ? 'Test edilecek kelime yok. Ekle sekmesinden yeni kelime ekleyin.'
    : selectedMode === 'daily'
      ? 'Grup 2–4’te kelime yok. Yeni kelimeleri önce Genel Tarama’da test edin.'
      : 'Henüz ezberlenen kelime yok. Grup 1’e giren kelimeler burada görünür.';

  return (
    <section aria-labelledby="test-title">
      <div className="section-heading">
        <p className="eyebrow">Sesli çalışma</p>
        <h2 id="test-title">Test türünü seç</h2>
        <p>Kelimeyi dinleyin; telaffuzunu ve Türkçe anlamını cevaplayın.</p>
      </div>

      <div className="segmented-control" role="tablist" aria-label="Test türleri">
        {modes.map((item) => (
          <button
            key={item.mode}
            type="button"
            role="tab"
            aria-selected={selectedMode === item.mode}
            className={selectedMode === item.mode ? 'is-selected' : ''}
            onClick={() => setSelectedMode(item.mode)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="empty-state">
        <span className="empty-state__icon" aria-hidden="true">◎</span>
        <h3>{pool.length > 0 ? `${pool.length} kelime hazır` : 'Bu çalışma havuzu boş'}</h3>
        <p>{pool.length > 0 ? modes.find((item) => item.mode === selectedMode)?.detail : emptyMessage}</p>
        {pool.length > 0 ? (
          <button className="primary-button" type="button" onClick={() => setSessionWords([...pool])}>Çalışmayı aç</button>
        ) : null}
        {selectedMode === 'daily' ? <span className="badge">Günlük 10’ar seçim Aşama 6</span> : null}
      </div>
    </section>
  );
}
