import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';

import { getLastBackupAt } from '../../db/backup';
import { db } from '../../db/schema';
import { FeatureCard } from '../../ui/FeatureCard';
import { BulkAdd } from './BulkAdd';
import { ManualAdd } from './ManualAdd';
import { PhotoAdd } from './PhotoAdd';

type AddMode = 'manual' | 'bulk' | null;

function isStandalone(): boolean {
  const iosStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  const displayModeStandalone =
    typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches;
  return displayModeStandalone || iosStandalone;
}

export function AddScreen() {
  const [mode, setMode] = useState<AddMode>(null);
  const [backupDue, setBackupDue] = useState(false);

  useEffect(() => {
    const subscription = liveQuery(() => Promise.all([db.words.count(), getLastBackupAt()])).subscribe({
      next([wordCount, lastBackupAt]) {
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        setBackupDue(wordCount > 0 && (!lastBackupAt || Date.now() - lastBackupAt > sevenDays));
      },
      error() {
        setBackupDue(false);
      },
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <section aria-labelledby="add-title">
      <div className="hero-card">
        <span className="hero-card__mark" aria-hidden="true">✦</span>
        <div>
          <p className="eyebrow">Yeni kelimeler</p>
          <h2 id="add-title">Çalışma listeni oluştur</h2>
          <p>Fotoğraftan, galeriden veya elle kelime ekleyebilirsin.</p>
        </div>
      </div>

      <PhotoAdd />
      <div className="stack add-manual-method" aria-label="Elle kelime ekleme yöntemi">
        <FeatureCard
          icon="✎"
          title="Elle veya toplu ekle"
          description="Tek kelime yaz ya da kelime-anlam satırlarını topluca yapıştır."
          badge="Hazır"
        >
          <div className="button-row">
            <button
              className={mode === 'manual' ? 'secondary-button is-active' : 'secondary-button'}
              type="button"
              onClick={() => setMode(mode === 'manual' ? null : 'manual')}
            >
              Tek kelime
            </button>
            <button
              className={mode === 'bulk' ? 'secondary-button is-active' : 'secondary-button'}
              type="button"
              onClick={() => setMode(mode === 'bulk' ? null : 'bulk')}
            >
              Toplu liste
            </button>
          </div>
        </FeatureCard>
      </div>

      {mode ? (
        <section className="editor-panel" aria-label={mode === 'manual' ? 'Tek kelime ekle' : 'Toplu kelime ekle'}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Çevrimdışı çalışır</p>
              <h3>{mode === 'manual' ? 'Tek kelime ekle' : 'Toplu kelime ekle'}</h3>
            </div>
            <button className="icon-button" type="button" onClick={() => setMode(null)} aria-label="Kapat">
              ×
            </button>
          </div>
          {mode === 'manual' ? <ManualAdd /> : <BulkAdd />}
        </section>
      ) : null}

      {!isStandalone() ? (
        <aside className="info-banner">
          <span aria-hidden="true">⌂</span>
          <p>Verilerini daha güvenli tutmak için uygulamayı tarayıcı menüsünden ana ekranına ekle.</p>
        </aside>
      ) : null}

      {backupDue ? (
        <aside className="info-banner info-banner--warning">
          <span aria-hidden="true">⇩</span>
          <p>Kelime listen için güncel yedek yok. Ayarlar’dan ücretsiz JSON yedeği alabilirsin.</p>
        </aside>
      ) : null}
    </section>
  );
}
