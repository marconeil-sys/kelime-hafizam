import { useRef, useState, type ChangeEvent } from 'react';

import {
  backupFileName,
  buildBackup,
  recordBackupCreated,
  restoreBackup,
} from '../../db/backup';
import { clearAllData } from '../../db/repo';

function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function BackupPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  async function handleBackup() {
    setBusy(true);
    setMessage(null);
    try {
      const backup = await buildBackup();
      const file = new File([JSON.stringify(backup, null, 2)], backupFileName(), {
        type: 'application/json',
      });
      const canShareFile =
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] });

      if (canShareFile) {
        try {
          await navigator.share({ files: [file], title: 'Kelime Hafızam yedeği' });
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') return;
          downloadFile(file);
        }
      } else {
        downloadFile(file);
      }

      await recordBackupCreated();
      setMessage({ tone: 'success', text: 'Yedek hazırlandı. Güvenli bir yerde saklayın.' });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Yedek oluşturulamadı.' });
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
        <button className="primary-button" type="button" onClick={() => void handleBackup()} disabled={busy}>
          Yedek al
        </button>
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
