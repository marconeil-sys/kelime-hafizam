import { describe, expect, it, vi } from 'vitest';

import {
  extractVocabularyFromImage,
  QuotaError,
  ServiceError,
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
