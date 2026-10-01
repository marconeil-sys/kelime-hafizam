import { useState } from 'react';

import { savePhotoCandidates } from '../../db/repo';
import type { ReviewCandidate } from '../../domain/photoCandidates';

interface ReviewCandidatesProps {
  initialCandidates: ReviewCandidate[];
  onClose: () => void;
}

const KIND_LABELS: Record<ReviewCandidate['kind'], string> = {
  new: 'Yeni',
  existing: 'Zaten var',
  different: 'Farklı anlam',
};

function meaningsFromText(value: string): string[] {
  return value.split(/\r?\n|;/u).map((meaning) => meaning.trim()).filter(Boolean);
}

export function ReviewCandidates({ initialCandidates, onClose }: ReviewCandidatesProps) {
  const [candidates, setCandidates] = useState(initialCandidates);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const newCount = candidates.filter((candidate) => candidate.kind === 'new').length;
  const existingCount = candidates.length - newCount;
  const hasActionableCandidate = candidates.some((candidate) => candidate.kind !== 'existing');
  const selectedCount = candidates.filter((candidate) => {
    const hasMeaning = meaningsFromText(candidate.meaningText).length > 0;
    return hasMeaning && (candidate.kind === 'new' ? candidate.selected : candidate.appendMeaning);
  }).length;

  function updateCandidate(id: string, changes: Partial<ReviewCandidate>) {
    setCandidates((current) => current.map((candidate) => (
      candidate.id === id ? { ...candidate, ...changes } : candidate
    )));
  }

  async function handleSave() {
    const selected = candidates.flatMap((candidate) => {
      const meanings = meaningsFromText(candidate.meaningText);
      const shouldSave = candidate.kind === 'new' ? candidate.selected : candidate.appendMeaning;
      if (!shouldSave || meanings.length === 0) return [];
      return [{
        term: candidate.term,
        meanings,
        partOfSpeech: candidate.partOfSpeech,
        exampleEn: candidate.exampleEn,
        appendToExisting: candidate.kind === 'different',
      }];
    });
    if (selected.length === 0) {
      setMessage({ tone: 'error', text: 'Kaydetmek için en az bir anlamı dolu aday seçin.' });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const result = await savePhotoCandidates(selected);
      const alreadyCount = candidates.filter((candidate) => candidate.kind !== 'new').length;
      setMessage({
        tone: 'success',
        text: `${result.addedWords} yeni kelime eklendi, ${alreadyCount} zaten vardı${result.duplicateWords ? `, ${result.duplicateWords} seçili kelime listede olduğu için atlandı` : ''}${result.updatedWords ? `, ${result.updatedWords} kelimeye yeni anlam eklendi` : ''}. Bu cihazda toplam ${result.totalWords} kelime var.`,
      });
      setCandidates([]);
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Adaylar kaydedilemedi.' });
    } finally {
      setSaving(false);
    }
  }

  if (candidates.length === 0) {
    return (
      <section className="editor-panel" aria-label="Fotoğraf sonucu">
        {message ? <p className={`form-message form-message--${message.tone}`} role="status">{message.text}</p> : null}
        <div className="button-row button-row--wrap">
          <a className="primary-button button-link" href="#/words">Kelimelerime git</a>
          <button className="secondary-button" type="button" onClick={onClose}>Başka sayfa tara</button>
        </div>
      </section>
    );
  }

  return (
    <section className="editor-panel candidate-review" aria-labelledby="candidate-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Kaydetmeden önce kontrol et</p>
          <h3 id="candidate-title">{candidates.length} kelime adayı</h3>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Adayları kapat">×</button>
      </div>
      <p className="candidate-summary">{newCount} yeni kelime · {existingCount} zaten vardı</p>
      <p className="field-help">Anlamları her satıra bir tane gelecek şekilde düzenleyebilirsiniz.</p>
      <div className="candidate-list">
        {candidates.map((candidate) => {
          const hasMeaning = meaningsFromText(candidate.meaningText).length > 0;
          const selectable = candidate.kind === 'new';
          return (
            <article key={candidate.id} className={`candidate-card candidate-card--${candidate.kind}`}>
              <div className="candidate-card__heading">
                {selectable ? (
                  <input
                    type="checkbox"
                    aria-label={`${candidate.term} kelimesini ekle`}
                    checked={candidate.selected && hasMeaning}
                    disabled={!hasMeaning}
                    onChange={(event) => updateCandidate(candidate.id, { selected: event.target.checked })}
                  />
                ) : <span className="candidate-card__spacer" />}
                <span className={`candidate-kind candidate-kind--${candidate.kind}`}>{KIND_LABELS[candidate.kind]}</span>
                <span className="candidate-source">{candidate.source === 'page' ? 'sayfadan' : 'otomatik öneri'}</span>
              </div>
              <div className="data-form candidate-fields">
                <label>
                  <span>İngilizce kelime</span>
                  <input
                    value={candidate.term}
                    onChange={(event) => updateCandidate(candidate.id, { term: event.target.value })}
                  />
                </label>
                <label>
                  <span>Türkçe anlam(lar)</span>
                  <textarea
                    rows={2}
                    value={candidate.meaningText}
                    onChange={(event) => updateCandidate(candidate.id, { meaningText: event.target.value })}
                  />
                </label>
              </div>
              {candidate.kind === 'different' ? (
                <label className="candidate-append">
                  <input
                    type="checkbox"
                    checked={candidate.appendMeaning && hasMeaning}
                    disabled={!hasMeaning}
                    onChange={(event) => updateCandidate(candidate.id, { appendMeaning: event.target.checked })}
                  />
                  <span>Bu anlamı mevcut kelimeye ekle</span>
                </label>
              ) : null}
              {!hasMeaning ? <p className="candidate-warning">Türkçe anlam yazılmadan kaydedilemez.</p> : null}
              {candidate.confidence < 0.7 ? (
                <p className="candidate-warning">⚠ Okuma güveni düşük (%{Math.round(candidate.confidence * 100)}); kelimeyi kontrol edin.</p>
              ) : null}
            </article>
          );
        })}
      </div>
      <div className="button-row button-row--wrap">
        {hasActionableCandidate ? (
          <button className="primary-button" type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Kaydediliyor…' : `Seçilenleri kaydet (${selectedCount})`}
          </button>
        ) : null}
        <button className="secondary-button" type="button" onClick={onClose} disabled={saving}>
          {hasActionableCandidate ? 'Vazgeç' : 'Tamam'}
        </button>
      </div>
      {message ? <p className={`form-message form-message--${message.tone}`} role="status">{message.text}</p> : null}
    </section>
  );
}
