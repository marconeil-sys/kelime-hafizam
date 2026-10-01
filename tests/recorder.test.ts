import { describe, expect, it, vi } from 'vitest';

import {
  rootMeanSquareFromTimeDomain,
  selectSupportedAudioMimeType,
} from '../src/services/recorder';

describe('ses kaydı yardımcıları', () => {
  it('desteklenen MIME türünü öncelik sırasıyla seçer', () => {
    const isTypeSupported = vi.fn((type: string) => type === 'audio/mp4');
    expect(selectSupportedAudioMimeType({ isTypeSupported })).toBe('audio/mp4');
    expect(isTypeSupported.mock.calls.map(([type]) => type)).toEqual([
      'audio/webm;codecs=opus',
      'audio/mp4',
    ]);
  });

  it('sessiz ve sesli zaman alanı örneklerini ayıracak RMS düzeyi üretir', () => {
    expect(rootMeanSquareFromTimeDomain(new Uint8Array([128, 128, 128]))).toBe(0);
    expect(rootMeanSquareFromTimeDomain(new Uint8Array([80, 176, 80, 176]))).toBeGreaterThan(0.3);
  });
});
