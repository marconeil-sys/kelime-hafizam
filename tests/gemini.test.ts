import { describe, expect, it, vi } from 'vitest';

import {
  extractVocabularyFromImage,
  QuotaError,
  ServiceError,
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
});
