import { BackupPanel } from './BackupPanel';

export function SettingsScreen() {
  return (
    <section aria-labelledby="settings-title">
      <div className="section-heading">
        <p className="eyebrow">Uygulama tercihleri</p>
        <h2 id="settings-title">Ayarlar</h2>
        <p>Yedeklerini yönet; ses ve Gemini tercihleri sonraki aşamalarda etkinleşecek.</p>
      </div>

      <div className="settings-list">
        <div className="setting-row">
          <span className="setting-row__icon" aria-hidden="true">◇</span>
          <div>
            <strong>Gemini bağlantısı</strong>
            <span>API anahtarı yalnız bu cihazda saklanacak</span>
          </div>
          <span className="badge">Aşama 3</span>
        </div>
        <div className="setting-row">
          <span className="setting-row__icon" aria-hidden="true">◖</span>
          <div>
            <strong>Ses ve aksan</strong>
            <span>Amerikan İngilizcesi · en-US</span>
          </div>
          <span className="badge">Aşama 4</span>
        </div>
      </div>

      <BackupPanel />

      <aside className="privacy-card">
        <strong>Gizlilik önce gelir</strong>
        <p>Hesap ve sunucu yok. Gemini anahtarı kaynak koda veya yedek dosyasına yazılmayacak.</p>
      </aside>
    </section>
  );
}
