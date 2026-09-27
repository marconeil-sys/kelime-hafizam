import { useState, type FormEvent } from 'react';

import { addWord, DuplicateWordError } from '../../db/repo';

export function ManualAdd() {
  const [term, setTerm] = useState('');
  const [meaning, setMeaning] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const saved = await addWord({ term, meanings: [meaning] });
      setTerm('');
      setMeaning('');
      setMessage({ tone: 'success', text: `“${saved.term}” eklendi.` });
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Kelime kaydedilemedi.';
      setMessage({ tone: 'error', text });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="data-form" onSubmit={handleSubmit}>
      <label>
        <span>İngilizce kelime</span>
        <input
          required
          autoCapitalize="none"
          autoComplete="off"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="ör. achieve"
        />
      </label>
      <label>
        <span>Türkçe anlamı</span>
        <input
          required
          value={meaning}
          onChange={(event) => setMeaning(event.target.value)}
          placeholder="ör. başarmak"
        />
      </label>
      <button className="primary-button" type="submit" disabled={saving}>
        {saving ? 'Kaydediliyor…' : 'Kelimeyi kaydet'}
      </button>
      {message ? (
        <p className={`form-message form-message--${message.tone}`} role="status">
          {message.text}
        </p>
      ) : null}
    </form>
  );
}
