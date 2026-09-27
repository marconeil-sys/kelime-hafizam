import { useState, type FormEvent } from 'react';

import { addWords } from '../../db/repo';
import { parseBulkWords } from '../../domain/bulkWords';

export function BulkAdd() {
  const [text, setText] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseBulkWords(text);
    if (parsed.candidates.length === 0) {
      setMessage({
        tone: 'error',
        text: parsed.errors[0]?.reason ?? 'En az bir “kelime - anlam” satırı yazın.',
      });
      return;
    }

    setSaving(true);
    try {
      const result = await addWords(parsed.candidates);
      const details = [
        `${result.added.length} yeni kelime eklendi`,
        result.duplicates.length ? `${result.duplicates.length} tekrar atlandı` : '',
        parsed.errors.length || result.rejected.length
          ? `${parsed.errors.length + result.rejected.length} satır düzeltilmeli`
          : '',
      ].filter(Boolean);
      setMessage({
        tone: parsed.errors.length || result.rejected.length ? 'error' : 'success',
        text: details.join(' · '),
      });
      if (result.added.length > 0 && parsed.errors.length === 0) setText('');
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Kelimeler eklenemedi.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="data-form" onSubmit={handleSubmit}>
      <label>
        <span>Her satıra bir kelime</span>
        <textarea
          required
          rows={7}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={'achieve - başarmak\nreliable - güvenilir'}
        />
      </label>
      <p className="field-help">Biçim: İngilizce kelime - Türkçe anlam</p>
      <button className="primary-button" type="submit" disabled={saving}>
        {saving ? 'Ekleniyor…' : 'Listeyi ekle'}
      </button>
      {message ? (
        <p className={`form-message form-message--${message.tone}`} role="status">
          {message.text}
        </p>
      ) : null}
    </form>
  );
}
