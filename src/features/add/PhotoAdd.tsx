import { useRef, useState, type ChangeEvent } from 'react';

import { getGeminiSettings } from '../../db/settings';
import { listWords } from '../../db/repo';
import { prepareReviewCandidates, type ReviewCandidate } from '../../domain/photoCandidates';
import { extractVocabularyFromImage } from '../../services/gemini';
import { resizeImage } from '../../services/image';
import { FeatureCard } from '../../ui/FeatureCard';
import { ReviewCandidates } from './ReviewCandidates';

export function PhotoAdd() {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<ReviewCandidate[] | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setMessage(null);
    setCandidates(null);
    try {
      const settings = await getGeminiSettings();
      if (!settings.apiKey) {
        throw new Error('Önce Ayarlar’dan ücretsiz Gemini API anahtarınızı kaydedin.');
      }
      const image = await resizeImage(file);
      const response = await extractVocabularyFromImage({
        apiKey: settings.apiKey,
        model: settings.visionModel,
        mimeType: image.mimeType,
        base64Data: image.base64Data,
        signal: controller.signal,
      });
      if (response.page_type === 'unreadable' || response.items.length === 0) {
        setMessage({ tone: 'error', text: 'Bu sayfa okunamadı. Daha aydınlık ve net bir fotoğraf deneyin.' });
        return;
      }
      const prepared = prepareReviewCandidates(response.items, await listWords());
      if (prepared.length === 0) {
        setMessage({ tone: 'error', text: 'Fotoğrafta kaydedilebilecek İngilizce kelime bulunamadı.' });
        return;
      }
      setCandidates(prepared);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setMessage({ tone: 'error', text: 'Fotoğraf taraması iptal edildi.' });
      } else {
        setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Fotoğraf okunamadı.' });
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  }

  function cancelScan() {
    abortRef.current?.abort();
  }

  return (
    <>
      <div className="stack photo-methods" aria-label="Fotoğraftan kelime ekleme yöntemleri">
        <FeatureCard
          icon="📷"
          title="Fotoğraftan ekle"
          description="Kelime sayfasının fotoğrafını çek ve adayları kontrol et."
          badge="Hazır"
        >
          <button className="secondary-button" type="button" onClick={() => cameraRef.current?.click()} disabled={loading}>
            Kamerayı aç
          </button>
          <input
            ref={cameraRef}
            className="sr-only"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(event) => void handleFile(event)}
          />
        </FeatureCard>
        <FeatureCard
          icon="▤"
          title="Galeriden seç"
          description="Telefonundaki bir kelime sayfasını Gemini ile oku."
          badge="Hazır"
        >
          <button className="secondary-button" type="button" onClick={() => galleryRef.current?.click()} disabled={loading}>
            Fotoğraf seç
          </button>
          <input
            ref={galleryRef}
            className="sr-only"
            type="file"
            accept="image/*"
            onChange={(event) => void handleFile(event)}
          />
        </FeatureCard>
      </div>
      {loading ? (
        <aside className="editor-panel photo-progress" aria-live="polite">
          <div>
            <strong>Fotoğraf okunuyor…</strong>
            <p>Fotoğraf cihazda küçültülüyor ve kelimeler çıkarılıyor.</p>
          </div>
          <button className="secondary-button" type="button" onClick={cancelScan}>İptal</button>
        </aside>
      ) : null}
      {message ? <p className={`form-message form-message--${message.tone}`} role="status">{message.text}</p> : null}
      {candidates ? <ReviewCandidates initialCandidates={candidates} onClose={() => setCandidates(null)} /> : null}
    </>
  );
}
