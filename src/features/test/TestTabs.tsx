const modes = [
  { label: 'Genel Tarama', detail: 'Yeni kelimeler ve Grup 2–4' },
  { label: 'Günlük Tarama', detail: 'Her gruptan en fazla 10 kelime' },
  { label: 'Ezberlediklerim', detail: 'Yalnız Grup 1 kelimeleri' },
] as const;

export function TestTabs() {
  return (
    <section aria-labelledby="test-title">
      <div className="section-heading">
        <p className="eyebrow">Sesli çalışma</p>
        <h2 id="test-title">Test türünü seç</h2>
        <p>Kelime havuzun hazır olduğunda çalışma oturumları burada başlayacak.</p>
      </div>

      <div className="segmented-control" role="tablist" aria-label="Test türleri">
        {modes.map((mode, index) => (
          <button
            key={mode.label}
            type="button"
            role="tab"
            aria-selected={index === 0}
            className={index === 0 ? 'is-selected' : ''}
          >
            {mode.label}
          </button>
        ))}
      </div>

      <div className="empty-state">
        <span className="empty-state__icon" aria-hidden="true">◎</span>
        <h3>Henüz test edilecek kelime yok</h3>
        <p>Önce Ekle sekmesinden çalışma listeni oluştur.</p>
        <span className="badge">Aşama 5–6</span>
      </div>
    </section>
  );
}

