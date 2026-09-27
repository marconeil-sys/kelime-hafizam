import { useState, type FormEvent } from 'react';

import { updateWord } from '../../db/repo';
import type { StoredWord } from '../../db/schema';

interface WordEditProps {
  word: StoredWord;
  onClose: () => void;
}

export function WordEdit({ word, onClose }: WordEditProps) {
  const [term, setTerm] = useState(word.term);
  const [meanings, setMeanings] = useState(word.meanings.join('\n'));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await updateWord(word.id, { term, meanings: meanings.split(/\r?\n/u) });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Değişiklik kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="data-form word-edit" onSubmit={handleSubmit}>
      <label>
        <span>İngilizce kelime</span>
        <input required value={term} onChange={(event) => setTerm(event.target.value)} />
      </label>
      <label>
        <span>Türkçe anlamlar (her satıra bir anlam)</span>
        <textarea required rows={3} value={meanings} onChange={(event) => setMeanings(event.target.value)} />
      </label>
      <div className="button-row">
        <button className="primary-button" type="submit" disabled={saving}>
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        <button className="secondary-button" type="button" onClick={onClose}>
          Vazgeç
        </button>
      </div>
      {error ? <p className="form-message form-message--error">{error}</p> : null}
    </form>
  );
}
