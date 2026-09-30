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

export function isVisionResponse(value: unknown): value is VisionResponse {
  if (!isRecord(value)) return false;
  if (!['word_list', 'text', 'mixed', 'unreadable'].includes(String(value.page_type))) return false;
  if (!Array.isArray(value.items)) return false;
  return value.items.every((item) => {
    if (!isRecord(item)) return false;
    return (
      typeof item.term === 'string' &&
      (item.meaning_tr_on_page === null ||
        item.meaning_tr_on_page === undefined ||
        typeof item.meaning_tr_on_page === 'string') &&
      Array.isArray(item.meaning_tr_suggested) &&
      item.meaning_tr_suggested.every((meaning) => typeof meaning === 'string') &&
      (item.part_of_speech === null || item.part_of_speech === undefined || typeof item.part_of_speech === 'string') &&
      (item.example_en === null || item.example_en === undefined || typeof item.example_en === 'string') &&
      typeof item.confidence === 'number' &&
      Number.isFinite(item.confidence) &&
      item.confidence >= 0 &&
      item.confidence <= 1
    );
  });
}

async function generateJson(request: GeminiRequest): Promise<unknown> {
  if (!request.apiKey.trim()) throw new ServiceError('Gemini API anahtarı eksik. Ayarlar’dan ekleyin.');
  if (!request.model.trim()) throw new ServiceError('Gemini model adı eksik.');
  const runFetch = request.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await runFetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(request.model.trim())}:generateContent`,
      {
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
      },
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ServiceError('Gemini bağlantısı kurulamadı. İnternet bağlantınızı kontrol edin.');
  }

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
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<VisionResponse> {
  const value = await generateJson({
    apiKey: input.apiKey,
    model: input.model,
    parts: [
      { inline_data: { mime_type: input.mimeType, data: input.base64Data } },
      { text: VOCABULARY_PROMPT },
    ],
    responseSchema: VISION_RESPONSE_SCHEMA,
    validate: isVisionResponse,
    signal: input.signal,
    fetchImpl: input.fetchImpl,
  });
  return value as VisionResponse;
}

export async function testGeminiKey(input: {
  apiKey: string;
  model: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
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
  });
}
