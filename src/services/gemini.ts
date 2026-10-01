export class GeminiServiceError extends Error {
  constructor(message = 'Gemini servisine ulaşılamadı.') {
    super(message);
    this.name = 'GeminiServiceError';
  }
}

export class QuotaError extends GeminiServiceError {
  constructor() {
    super('Bugünkü ücretsiz Gemini kotası doldu. Elle eklemeye devam edebilirsiniz.');
    this.name = 'QuotaError';
  }
}

export class ServiceError extends GeminiServiceError {
  constructor(message = 'Gemini geçerli bir yanıt vermedi. Lütfen yeniden deneyin.') {
    super(message);
    this.name = 'ServiceError';
  }
}

export class TemporaryServiceError extends ServiceError {
  constructor() {
    super('Gemini şu anda yoğun. Otomatik denemeler başarısız oldu; 1–2 dakika sonra aynı fotoğrafı yeniden seçin.');
    this.name = 'TemporaryServiceError';
  }
}

export type VisionPageType = 'word_list' | 'text' | 'mixed' | 'unreadable';

export interface VisionItem {
  term: string;
  meaning_tr_on_page?: string | null;
  meaning_tr_suggested: string[];
  part_of_speech?: string | null;
  example_en?: string | null;
  confidence: number;
}

export interface VisionResponse {
  page_type: VisionPageType;
  items: VisionItem[];
}

interface GeminiRequest {
  apiKey: string;
  model: string;
  parts: Array<Record<string, unknown>>;
  responseSchema: Record<string, unknown>;
  validate: (value: unknown) => boolean;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  retryDelaysMs?: readonly number[];
}

const DEFAULT_RETRY_DELAYS_MS = [1_000, 2_000] as const;

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 500 || status === 502 || status === 503 || status === 504;
}

function waitForRetry(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(new DOMException('İstek iptal edildi.', 'AbortError'));
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', handleAbort);
      resolve();
    }, delayMs);
    function handleAbort() {
      window.clearTimeout(timer);
      reject(new DOMException('İstek iptal edildi.', 'AbortError'));
    }
    signal?.addEventListener('abort', handleAbort, { once: true });
  });
}

interface GeminiEnvelope {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; thought?: boolean }> };
  }>;
}

export const VOCABULARY_PROMPT = `You extract English vocabulary from a photo of a study page for a Turkish learner.
Return ONLY JSON matching the schema.
Rules:
- If the page is a word list / glossary / two-column English–Turkish list: return EVERY English entry.
- If the page is running text: return the English words and phrasal verbs/idioms that are worth studying; skip proper nouns, numbers, and very basic function words (a, an, the, is, are, and, or, to, of, in, on, at, I, you, he, she, it, we, they).
- "term": the headword as written; if inflected (running, went, cars) give the base form (run, go, car). Lowercase unless it is normally capitalized.
- "meaning_tr_on_page": the Turkish meaning exactly as printed next to it, or null if none.
- "meaning_tr_suggested": 1–3 short common Turkish meanings (always fill, even if on page).
- "confidence": 0–1, how sure you are the term was read correctly.
- If the image is unreadable, return page_type "unreadable" and an empty items array.`;

export const VISION_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    page_type: { type: 'string', enum: ['word_list', 'text', 'mixed', 'unreadable'] },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          term: { type: 'string' },
          meaning_tr_on_page: { type: 'string', nullable: true },
          meaning_tr_suggested: { type: 'array', items: { type: 'string' } },
          part_of_speech: { type: 'string', nullable: true },
          example_en: { type: 'string', nullable: true },
          confidence: { type: 'number' },
        },
        required: ['term', 'meaning_tr_suggested', 'confidence'],
      },
    },
  },
  required: ['page_type', 'items'],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isVisionEnvelope(value: unknown): value is Record<string, unknown> & { items: unknown[] } {
  if (!isRecord(value)) return false;
  if (!['word_list', 'text', 'mixed', 'unreadable'].includes(String(value.page_type))) return false;
  return Array.isArray(value.items);
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Gemini bazen tek bir alanı şemadan farklı döndürebilir. Geçersiz tek adayın
 * okunabilen bütün sayfayı düşürmesine izin vermeden adayları tek tek temizler.
 */
export function sanitizeVisionResponse(value: unknown): VisionResponse | null {
  if (!isVisionEnvelope(value)) return null;

  const items = value.items.flatMap((item): VisionItem[] => {
    if (!isRecord(item) || typeof item.term !== 'string' || !item.term.trim()) return [];
    if (
      !Array.isArray(item.meaning_tr_suggested) ||
      !item.meaning_tr_suggested.every((meaning) => typeof meaning === 'string') ||
      typeof item.confidence !== 'number' ||
      !Number.isFinite(item.confidence)
    ) return [];

    const meanings = item.meaning_tr_suggested.map((meaning) => meaning.trim()).filter(Boolean);
    if (meanings.length === 0) return [];

    let confidence = item.confidence;
    if (confidence > 1) confidence /= 100;
    confidence = Math.max(0, Math.min(1, confidence));

    const meaningOnPage = optionalString(item.meaning_tr_on_page);
    const partOfSpeech = optionalString(item.part_of_speech);
    const exampleEn = optionalString(item.example_en);
    return [{
      term: item.term.trim(),
      meaning_tr_suggested: meanings,
      confidence,
      ...(meaningOnPage ? { meaning_tr_on_page: meaningOnPage } : item.meaning_tr_on_page === null ? { meaning_tr_on_page: null } : {}),
      ...(partOfSpeech ? { part_of_speech: partOfSpeech } : item.part_of_speech === null ? { part_of_speech: null } : {}),
      ...(exampleEn ? { example_en: exampleEn } : item.example_en === null ? { example_en: null } : {}),
    }];
  });

  return { page_type: value.page_type as VisionPageType, items };
}

export function isVisionResponse(value: unknown): value is VisionResponse {
  return sanitizeVisionResponse(value) !== null;
}

async function generateJson(request: GeminiRequest): Promise<unknown> {
  if (!request.apiKey.trim()) throw new ServiceError('Gemini API anahtarı eksik. Ayarlar’dan ekleyin.');
  if (!request.model.trim()) throw new ServiceError('Gemini model adı eksik.');
  const runFetch = request.fetchImpl ?? fetch;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(request.model.trim())}:generateContent`;
  const options: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': request.apiKey.trim(),
    },
    body: JSON.stringify({
      contents: [{ parts: request.parts }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: request.responseSchema,
      },
    }),
    signal: request.signal,
  };
  const retryDelays = request.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS.map(
    (delay) => delay + Math.floor(Math.random() * 250),
  );

  let response: Response | undefined;
  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    try {
      response = await runFetch(url, options);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      throw new ServiceError('Gemini bağlantısı kurulamadı. İnternet bağlantınızı kontrol edin.');
    }
    if (!isRetryableStatus(response.status)) break;
    if (attempt === retryDelays.length) throw new TemporaryServiceError();
    await waitForRetry(retryDelays[attempt]!, request.signal);
  }
  if (!response) throw new ServiceError();

  if (response.status === 429) throw new QuotaError();
  if (!response.ok) {
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      throw new ServiceError('Gemini anahtarı veya model adı kabul edilmedi. Ayarları kontrol edin.');
    }
    throw new ServiceError(`Gemini servis hatası (${response.status}).`);
  }

  let envelope: GeminiEnvelope;
  try {
    envelope = (await response.json()) as GeminiEnvelope;
  } catch {
    throw new ServiceError();
  }

  const text = envelope.candidates?.[0]?.content?.parts
    ?.filter((part) => !part.thought)
    ?.map((part) => part.text ?? '')
    .join('')
    .trim();
  if (!text) throw new ServiceError();

  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new ServiceError();
  }
  if (!request.validate(value)) throw new ServiceError();
  return value;
}

export async function extractVocabularyFromImage(input: {
  apiKey: string;
  model: string;
  mimeType: string;
  base64Data: string;
  fallbackModel?: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  retryDelaysMs?: readonly number[];
}): Promise<VisionResponse> {
  const models = [...new Set([input.model.trim(), input.fallbackModel?.trim()].filter(Boolean))] as string[];
  for (let index = 0; index < models.length; index += 1) {
    try {
      const value = await generateJson({
        apiKey: input.apiKey,
        model: models[index]!,
        parts: [
          { inline_data: { mime_type: input.mimeType, data: input.base64Data } },
          { text: VOCABULARY_PROMPT },
        ],
        responseSchema: VISION_RESPONSE_SCHEMA,
        validate: isVisionEnvelope,
        signal: input.signal,
        fetchImpl: input.fetchImpl,
        retryDelaysMs: input.retryDelaysMs,
      });
      const sanitized = sanitizeVisionResponse(value);
      if (!sanitized) throw new ServiceError();
      return sanitized;
    } catch (error) {
      const hasFallback = index < models.length - 1;
      const canTryFallback = error instanceof TemporaryServiceError || error instanceof QuotaError;
      if (!canTryFallback || !hasFallback) throw error;
    }
  }
  throw new TemporaryServiceError();
}

export async function testGeminiKey(input: {
  apiKey: string;
  model: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  retryDelaysMs?: readonly number[];
}): Promise<void> {
  const schema = {
    type: 'object',
    properties: { ok: { type: 'boolean' } },
    required: ['ok'],
  };
  const isTestResponse = (value: unknown) => isRecord(value) && value.ok === true;
  await generateJson({
    apiKey: input.apiKey,
    model: input.model,
    parts: [{ text: 'Return only {"ok":true} to confirm the connection.' }],
    responseSchema: schema,
    validate: isTestResponse,
    signal: input.signal,
    fetchImpl: input.fetchImpl,
    retryDelaysMs: input.retryDelaysMs,
  });
}

export async function testGeminiModels(input: {
  apiKey: string;
  visionModel: string;
  judgeModel: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  retryDelaysMs?: readonly number[];
}): Promise<void> {
  try {
    await testGeminiKey({
      apiKey: input.apiKey,
      model: input.visionModel,
      signal: input.signal,
      fetchImpl: input.fetchImpl,
      retryDelaysMs: input.retryDelaysMs,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Bilinmeyen hata.';
    throw new ServiceError(`Fotoğraf okuma modeli test edilemedi: ${detail}`);
  }

  try {
    await testGeminiKey({
      apiKey: input.apiKey,
      model: input.judgeModel,
      signal: input.signal,
      fetchImpl: input.fetchImpl,
      retryDelaysMs: input.retryDelaysMs,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Bilinmeyen hata.';
    throw new ServiceError(`Değerlendirme modeli test edilemedi: ${detail}`);
  }
}
