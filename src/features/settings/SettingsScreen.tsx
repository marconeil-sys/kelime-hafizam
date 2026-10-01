import { AudioSettingsPanel } from './AudioSettingsPanel';
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

      <AudioSettingsPanel />
      <GeminiSettingsPanel />
      <BackupPanel />

      <aside className="privacy-card">
        <strong>Gizlilik önce gelir</strong>
        <p>Hesap ve sunucu yok. Gemini anahtarı yalnız IndexedDB’de tutulur; kaynak koda, fotoğrafa veya yedek dosyasına yazılmaz.</p>
      </aside>
    </section>
  );
}
