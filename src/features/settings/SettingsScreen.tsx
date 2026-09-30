import { BackupPanel } from './BackupPanel';
import { GeminiSettingsPanel } from './GeminiSettingsPanel';

export function SettingsScreen() {
  return (
    <section aria-labelledby="settings-title">
      <div className="section-heading">
        <p className="eyebrow">Uygulama tercihleri</p>
        <h2 id="settings-title">Ayarlar</h2>
        <p>Gemini bağlantını, uygulama tercihlerini ve yedeklerini yönet.</p>
      </div>

      <div className="settings-list">
        <div className="setting-row">
          <span className="setting-row__icon" aria-hidden="true">◖</span>
          <div>
            <strong>Ses ve aksan</strong>
            <span>Amerikan İngilizcesi · en-US</span>
          </div>
          <span className="badge">Aşama 4</span>
        </div>
      </div>

      <GeminiSettingsPanel />
      <BackupPanel />

      <aside className="privacy-card">
        <strong>Gizlilik önce gelir</strong>
        <p>Hesap ve sunucu yok. Gemini anahtarı yalnız IndexedDB’de tutulur; kaynak koda, fotoğrafa veya yedek dosyasına yazılmaz.</p>
      </aside>
    </section>
  );
}
