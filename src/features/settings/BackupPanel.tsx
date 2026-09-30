import { useRef, useState, type ChangeEvent } from 'react';

import { restoreBackup } from '../../db/backup';
import { clearAllData } from '../../db/repo';
import { prepareBackupFile, savePreparedBackup } from './backupFile';

export function BackupPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preparedFile, setPreparedFile] = useState<File | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  async function handlePrepareBackup() {
    setBusy(true);
    setMessage(null);
    try {
      setPreparedFile(await prepareBackupFile());
      setMessage({ tone: 'success', text: 'Yedek dosyası hazır. Şimdi “Kaydet / Paylaş”a dokunun.' });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Yedek oluşturulamadı.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveBackup() {
    if (!preparedFile) return;
    setBusy(true);
    setMessage(null);
    try {
      await savePreparedBackup(preparedFile);
      setPreparedFile(null);
      setMessage({ tone: 'success', text: 'Yedek kaydedildi. Güvenli bir yerde saklayın.' });
    } catch (error) {
      const cancelled = error instanceof DOMException && error.name === 'AbortError';
      const permissionLost = error instanceof DOMException && error.name === 'NotAllowedError';
      setMessage({
        tone: 'error',
        text: cancelled
          ? 'Paylaşım iptal edildi. Hazır dosyayı yeniden kaydedebilirsiniz.'
          : permissionLost
            ? 'Paylaşım açılamadı. “Kaydet / Paylaş”a yeniden dokunun.'
            : error instanceof Error
              ? error.message
              : 'Yedek kaydedilemedi.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await restoreBackup(await file.text());
      setMessage({
        tone: 'success',
        text: `${result.addedWords} kelime eklendi, ${result.mergedWords} kelime birleştirildi.`,
      });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Yedek yüklenemedi.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleClear() {
    if (!window.confirm('Tüm kelimeler, test geçmişi ve ayarlar bu cihazdan silinsin mi?')) return;
    setBusy(true);
    try {
      await clearAllData();
      setMessage({ tone: 'success', text: 'Bu cihazdaki uygulama verileri silindi.' });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Veriler silinemedi.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="settings-panel" aria-labelledby="backup-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Cihazlar arası taşı</p>
          <h3 id="backup-title">Yedekleme</h3>
        </div>
        <span className="setting-row__icon" aria-hidden="true">⇩</span>
      </div>
      <p>
        JSON yedeği kelimeleri ve ilerlemeyi içerir. Gemini API anahtarı hiçbir zaman yedeğe eklenmez.
      </p>
      <div className="button-row button-row--wrap">
        <button className="primary-button" type="button" onClick={() => void handlePrepareBackup()} disabled={busy}>
          Yedeği hazırla
        </button>
        {preparedFile ? (
          <button className="primary-button" type="button" onClick={() => void handleSaveBackup()} disabled={busy}>
            Kaydet / Paylaş
          </button>
        ) : null}
        <button
          className="secondary-button"
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          Yedekten yükle
        </button>
        <input ref={inputRef} className="sr-only" type="file" accept="application/json,.json" onChange={handleRestore} />
      </div>
      <button className="danger-button" type="button" onClick={() => void handleClear()} disabled={busy}>
        Bu cihazdaki tüm veriyi sil
      </button>
      {message ? (
        <p className={`form-message form-message--${message.tone}`} role="status">
          {message.text}
        </p>
      ) : null}
    </section>
  );
}
