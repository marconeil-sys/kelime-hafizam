import { describe, expect, it, vi } from 'vitest';

import {
  extractVocabularyFromImage,
  judgeMeaningAudio,
  judgeMeaningText,
  judgePronunciationAudio,
  QuotaError,
  ServiceError,
  testGeminiModels,
  TemporaryServiceError,
} from '../src/services/gemini';

function responseWithText(text: string): Response {
  return new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text }] } }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

const baseInput = {
  apiKey: 'test-key-not-real',
  model: 'gemini-test',
  mimeType: 'image/jpeg',
  base64Data: 'ZmFrZQ==',
};

describe('Gemini servisi', () => {
  it('HTTP 429 yanıtını QuotaError yapar', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 429 })) as unknown as typeof fetch;
    await expect(extractVocabularyFromImage({ ...baseInput, fetchImpl })).rejects.toBeInstanceOf(QuotaError);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('503 için artan beklemeli yeniden deneme yapıp sonraki başarılı yanıtı kullanır', async () => {
    const payload = { page_type: 'word_list', items: [] };
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(responseWithText(JSON.stringify(payload))) as unknown as typeof fetch;

    await expect(extractVocabularyFromImage({
      ...baseInput,
      fetchImpl,
      retryDelaysMs: [0, 0],
    })).resolves.toEqual(payload);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('ana model 503 kalırsa görüntü destekli yedek modele geçer', async () => {
    const payload = { page_type: 'word_list', items: [] };
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(responseWithText(JSON.stringify(payload)));
    const fetchImpl = fetchSpy as unknown as typeof fetch;

    await expect(extractVocabularyFromImage({
      ...baseInput,
      fallbackModel: 'gemini-fallback',
      fetchImpl,
      retryDelaysMs: [],
    })).resolves.toEqual(payload);
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('/gemini-test:generateContent');
    expect(String(fetchSpy.mock.calls[1]?.[0])).toContain('/gemini-fallback:generateContent');
  });

  it('ana modelin kotası dolarsa yedek modele geçer', async () => {
    const payload = { page_type: 'word_list', items: [] };
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 429 }))
      .mockResolvedValueOnce(responseWithText(JSON.stringify(payload)));

    await expect(extractVocabularyFromImage({
      ...baseInput,
      fallbackModel: 'gemini-fallback',
      fetchImpl: fetchSpy as unknown as typeof fetch,
    })).resolves.toEqual(payload);
    expect(String(fetchSpy.mock.calls[1]?.[0])).toContain('/gemini-fallback:generateContent');
  });

  it('ana ve yedek modelin ikisi de 429 verirse QuotaError döndürür', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 429 })) as unknown as typeof fetch;
    await expect(extractVocabularyFromImage({
      ...baseInput,
      fallbackModel: 'gemini-fallback',
      fetchImpl,
    })).rejects.toBeInstanceOf(QuotaError);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('tüm yeniden denemeler tükenirse anlaşılır geçici servis hatası verir', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 503 })) as unknown as typeof fetch;
    await expect(extractVocabularyFromImage({
      ...baseInput,
      fetchImpl,
      retryDelaysMs: [0, 0],
    })).rejects.toBeInstanceOf(TemporaryServiceError);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('geçersiz JSON model yanıtını ServiceError yapar', async () => {
    const fetchImpl = vi.fn(async () => responseWithText('json değil')) as unknown as typeof fetch;
    await expect(extractVocabularyFromImage({ ...baseInput, fetchImpl })).rejects.toBeInstanceOf(ServiceError);
  });

  it('şemaya uygun adayları döndürür ve anahtarı başlıkta gönderir', async () => {
    const payload = {
      page_type: 'word_list',
      items: [{
        term: 'run',
        meaning_tr_on_page: 'koşmak',
        meaning_tr_suggested: ['koşmak'],
        confidence: 0.97,
      }],
    };
    const fetchImpl = vi.fn(async () => responseWithText(JSON.stringify(payload))) as unknown as typeof fetch;

    await expect(extractVocabularyFromImage({ ...baseInput, fetchImpl })).resolves.toEqual(payload);
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining('/gemini-test:generateContent'),
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-goog-api-key': 'test-key-not-real' }),
      }),
    );
  });

  it('bozuk adayı atar, yüzde güvenini 0–1 aralığına çevirir ve geçerli adayı korur', async () => {
    const payload = {
      page_type: 'word_list',
      items: [
        { term: 'careful', meaning_tr_suggested: ['dikkatli'], confidence: 95 },
        { term: 42, meaning_tr_suggested: ['bozuk'], confidence: 0.8 },
      ],
    };
    const fetchImpl = vi.fn(async () => responseWithText(JSON.stringify(payload))) as unknown as typeof fetch;

    await expect(extractVocabularyFromImage({ ...baseInput, fetchImpl })).resolves.toEqual({
      page_type: 'word_list',
      items: [{ term: 'careful', meaning_tr_suggested: ['dikkatli'], confidence: 0.95 }],
    });
  });

  it('sayfada basılı anlam varsa öneri listesi boş olsa da adayı korur', async () => {
    const payload = {
      page_type: 'word_list',
      items: [{
        term: 'book',
        meaning_tr_on_page: 'kitap',
        meaning_tr_suggested: [],
        confidence: 0.99,
      }],
    };
    const fetchImpl = vi.fn(async () => responseWithText(JSON.stringify(payload))) as unknown as typeof fetch;
    await expect(extractVocabularyFromImage({ ...baseInput, fetchImpl })).resolves.toEqual(payload);
  });

  it('anahtar testinde iki modeli de dener ve hatalı modelin görevini belirtir', async () => {
    const success = responseWithText('{"ok":true}');
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce(success)
      .mockResolvedValueOnce(new Response('{}', { status: 400 }));

    await expect(testGeminiModels({
      apiKey: 'key',
      visionModel: 'vision-model',
      judgeModel: 'judge-model',
      fetchImpl: fetchSpy as unknown as typeof fetch,
    })).rejects.toThrow('Değerlendirme modeli test edilemedi');
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('/vision-model:generateContent');
    expect(String(fetchSpy.mock.calls[1]?.[0])).toContain('/judge-model:generateContent');
  });

  it('telaffuz sesini structured JSON ile değerlendirir', async () => {
    const payload = { heard: 'run', verdict: 'correct', feedback_tr: '' };
    const fetchSpy = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => responseWithText(JSON.stringify(payload)));
    await expect(judgePronunciationAudio({
      apiKey: 'key',
      model: 'judge',
      term: 'run',
      accent: 'en-US',
      audio: new Blob(['voice']),
      mimeType: 'audio/webm',
      fetchImpl: fetchSpy as unknown as typeof fetch,
    })).resolves.toEqual(payload);
    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body)) as {
      contents: Array<{ parts: Array<Record<string, unknown>> }>;
    };
    expect(body.contents[0]?.parts[0]).toHaveProperty('inline_data');
  });

  it('Türkçe anlamı hem metinden hem sesten değerlendirebilir', async () => {
    const payload = {
      transcript: 'koşmak',
      verdict: 'correct',
      reason_tr: 'Eş anlamlı.',
      is_new_valid_meaning: false,
    };
    const fetchImpl = vi.fn(async () => responseWithText(JSON.stringify(payload))) as unknown as typeof fetch;
    await expect(judgeMeaningText({
      apiKey: 'key', model: 'judge', term: 'run', meanings: ['koşmak'], transcripts: ['koşmak'], fetchImpl,
    })).resolves.toEqual(payload);
    await expect(judgeMeaningAudio({
      apiKey: 'key', model: 'judge', term: 'run', meanings: ['koşmak'],
      audio: new Blob(['voice']), mimeType: 'audio/mp4', fetchImpl,
    })).resolves.toEqual(payload);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
