# Kelime Hafızam

İngilizce kelime öğrenmek için telefon odaklı, ana ekrana kurulabilen bir PWA. Aktif ürün şartnamesi bir üst klasördeki `SON_PLAN.md` dosyasıdır.

## Yerel geliştirme

Gereksinim: Node.js 22.12 veya üzeri.

```bash
npm install
npm run dev
```

Kalite kontrolü:

```bash
npm run check
```

Üretim paketini yerelde denemek:

```bash
npm run build
npm run preview -- --host 0.0.0.0
```

## Telefona kurma

### iPhone

1. GitHub Pages adresini Safari'de açın.
2. Paylaş düğmesine dokunun.
3. **Ana Ekrana Ekle** seçeneğini seçin.
4. Uygulamayı oluşan ana ekran simgesinden açın.

### Android

1. GitHub Pages adresini Chrome'da açın.
2. Menüden **Uygulamayı yükle** veya **Ana ekrana ekle** seçeneğini seçin.

İlk çevrimiçi açılıştan sonra uygulama kabuğu service worker tarafından önbelleğe alınır ve çevrimdışı açılabilir.

Yeni sürüm hazır olduğunda uygulama kendiliğinden sayfayı yenilemez. Ekrandaki **Güncelle** düğmesiyle, aktif bir çalışma oturumu yokken kullanıcı kontrollü olarak güncellenir.

## Yerel veri ve yedek

- Kelimeler IndexedDB içinde yalnız cihazda saklanır.
- Tekli ekleme ve `kelime - anlam` biçiminde toplu ekleme çevrimdışı çalışır.
- Aynı İngilizce kelimenin normalleştirilmiş biçimi ikinci kez eklenmez.
- Ayarlar ekranındaki JSON yedeği kelimeleri ve ilerlemeyi taşır; Gemini API anahtarı yedeğe dahil edilmez.

## GitHub Pages

`.github/workflows/deploy.yml`, `main` dalına her gönderimde kontrol, derleme ve Pages dağıtımı yapar. Vite taban yolu GitHub Actions'taki depo adından otomatik oluşturulur; HashRouter doğrudan bağlantı sorunlarını önler.

GitHub'da depo oluşturulduktan sonra **Settings → Pages → Source: GitHub Actions** seçilmelidir.
