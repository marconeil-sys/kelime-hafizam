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

## Fotoğraftan kelime ekleme

1. [Google AI Studio](https://aistudio.google.com/app/apikey) üzerinden ücretsiz katman API anahtarı oluşturun. Anahtarın projesine faturalandırma hesabı bağlamayın.
2. Uygulamada **Ayarlar → Gemini bağlantısı** bölümüne anahtarı yapıştırıp kaydedin ve **Anahtarı test et** düğmesini kullanın.
3. **Ekle** ekranında kamerayı açın veya galeriden bir sayfa seçin; gelen kelime ve anlamları kontrol ederek kaydedin.

Anahtar yalnız cihazın IndexedDB alanında tutulur; kaynak koda, üretim paketine ve yedek dosyasına girmez. Fotoğraf Gemini'ye gönderilmeden önce cihazda en uzun kenarı 2000 piksel olacak şekilde JPEG'e çevrilir ve uygulama tarafından saklanmaz. Ücretsiz katmanın kotası dolarsa istek reddedilir; uygulama ücretli isteğe geçmez.

## Sesli flashcard testi

- Kelime, seçilen `en-US` veya `en-GB` cihaz sesiyle okunur; mikrofon düğmesi ancak seslendirme tamamlandıktan sonra açılır.
- Otomatik mod önce Web Speech kullanır. Aynı oturumda iki ardışık servis hatası olursa Gemini ses kaydına, o hazır değilse elle değerlendirmeye geçer.
- Telaffuz ve Türkçe anlam ayrı değerlendirilir. Sessizlik, izin reddi, ağ veya kota hatası yanlış cevap olarak kaydedilmez.
- İki geçerli sonuç tamamlandıktan sonra kart tek IndexedDB transaction'ında deneme geçmişine yazılır ve kelime Grup 1–4'e atanır.
- Gemini'ye gönderilen ses yalnız o değerlendirme isteği için bellekte tutulur; uygulama ham ses kaydını IndexedDB'ye veya yedeğe yazmaz.

Günlük taramanın 10'ar kelimelik sabit listesi ve yarım oturum devamı Aşama 6 kapsamındadır.

## GitHub Pages

`.github/workflows/deploy.yml`, `main` dalına her gönderimde kontrol, derleme ve Pages dağıtımı yapar. Vite taban yolu GitHub Actions'taki depo adından otomatik oluşturulur; HashRouter doğrudan bağlantı sorunlarını önler.

GitHub'da depo oluşturulduktan sonra **Settings → Pages → Source: GitHub Actions** seçilmelidir.
