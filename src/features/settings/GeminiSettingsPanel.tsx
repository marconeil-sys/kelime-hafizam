import { useEffect, useState, type FormEvent } from 'react';

import {
  DEFAULT_JUDGE_MODEL,
  DEFAULT_VISION_MODEL,
  getGeminiSettings,
  saveGeminiSettings,
} from '../../db/settings';
import { testGeminiModels } from '../../services/gemini';

type Message = { tone: 'success' | 'error'; text: string };

export function GeminiSettingsPanel() {
  const [apiKey, setApiKey] = useState('');
  const [visionModel, setVisionModel] = useState(DEFAULT_VISION_MODEL);
  const [judgeModel, setJudgeModel] = useState(DEFAULT_JUDGE_MODEL);
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  useEffect(() => {
    let active = true;
    void getGeminiSettings().then((settings) => {
      if (!active) return;
      setApiKey(settings.apiKey);
      setVisionModel(settings.visionModel);
      setJudgeModel(settings.judgeModel);
    }).catch(() => {
      if (active) setMessage({ tone: 'error', text: 'Gemini ayarları okunamadı.' });
    });
    return () => {
      active = false;
    };
  }, []);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await saveGeminiSettings({ apiKey, visionModel, judgeModel });
      setMessage({ tone: 'success', text: 'Gemini ayarları yalnız bu cihaza kaydedildi.' });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Ayarlar kaydedilemedi.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleTest() {
    setBusy(true);
    setMessage(null);
    try {
      await testGeminiModels({ apiKey, visionModel, judgeModel });
      setMessage({ tone: 'success', text: 'Fotoğraf okuma ve değerlendirme modelleri çalışıyor.' });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Bağlantı kurulamadı.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="settings-panel" aria-labelledby="gemini-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Ücretsiz yapay zekâ</p>
          <h3 id="gemini-title">Gemini bağlantısı</h3>
        </div>
        <span className="setting-row__icon" aria-hidden="true">◇</span>
      </div>
      <form className="data-form" onSubmit={handleSave}>
        <label>
          <span>Gemini API anahtarı</span>
          <input
            type={showKey ? 'text' : 'password'}
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="AI Studio anahtarınızı buraya yapıştırın"
          />
        </label>
        <button className="filter-clear" type="button" onClick={() => setShowKey((current) => !current)}>
          {showKey ? 'Anahtarı gizle' : 'Anahtarı göster'}
        </button>
        <label>
          <span>Fotoğraf okuma modeli</span>
          <input
            required
            autoCapitalize="none"
            spellCheck={false}
            value={visionModel}
            onChange={(event) => setVisionModel(event.target.value)}
          />
        </label>
        <label>
          <span>Değerlendirme modeli</span>
          <input
            required
            autoCapitalize="none"
            spellCheck={false}
            value={judgeModel}
            onChange={(event) => setJudgeModel(event.target.value)}
          />
        </label>
        <div className="button-row button-row--wrap">
          <button className="primary-button" type="submit" disabled={busy}>Ayarları kaydet</button>
          <button className="secondary-button" type="button" onClick={() => void handleTest()} disabled={busy || !apiKey.trim()}>
            Anahtarı test et
          </button>
        </div>
      </form>
      <p className="field-help settings-note">
        Billing bağlanmamış ücretsiz bir AI Studio anahtarı kullanın. Kota dolarsa ücret çıkmaz; istek reddedilir.
        Ücretsiz katmanda gönderdiğiniz sayfa fotoğrafları Google tarafından ürün geliştirmede kullanılabilir.
      </p>
      <a className="settings-link" href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">
        AI Studio’da ücretsiz anahtar oluştur ↗
      </a>
      {message ? <p className={`form-message form-message--${message.tone}`} role="status">{message.text}</p> : null}
    </section>
  );
}
