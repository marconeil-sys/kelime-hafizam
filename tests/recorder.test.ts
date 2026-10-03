import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  rootMeanSquareFromTimeDomain,
  isUsableRecordedAudio,
  recordAudioClip,
  selectSupportedAudioMimeType,
} from '../src/services/recorder';

describe('ses kaydı yardımcıları', () => {
  afterEach(() => vi.useRealTimers());
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

  it('300 ms altındaki veya boş kaydı geçersiz sayar', () => {
    expect(isUsableRecordedAudio(299, 20)).toBe(false);
    expect(isUsableRecordedAudio(300, 0)).toBe(false);
    expect(isUsableRecordedAudio(300, 1)).toBe(true);
  });

  it('AudioContext askıda kalırsa seviyeyi bilinmiyor sayar, sessiz demez', async () => {
    vi.useFakeTimers();
    class FakeRecorder {
      static isTypeSupported(type: string) { return type === 'audio/mp4'; }
      state: RecordingState = 'inactive';
      mimeType = 'audio/mp4';
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onstop: (() => void) | null = null;
      constructor(_stream: MediaStream, _options?: MediaRecorderOptions) {}
      start() { this.state = 'recording'; }
      stop() {
        this.state = 'inactive';
        this.ondataavailable?.({ data: new Blob(['audio']) } as BlobEvent);
        this.onstop?.();
      }
    }
    class SuspendedAudioContext {
      state: AudioContextState = 'suspended';
      resume = vi.fn(async () => undefined);
      close = vi.fn(async () => undefined);
    }
    const track = { stop: vi.fn() };
    const stream = { getTracks: () => [track] } as unknown as MediaStream;
    const promise = recordAudioClip({
      maxDurationMs: 400,
      getUserMedia: async () => stream,
      Recorder: FakeRecorder as unknown as typeof MediaRecorder,
      AudioContextClass: SuspendedAudioContext as unknown as typeof AudioContext,
    });
    await vi.advanceTimersByTimeAsync(400);
    await expect(promise).resolves.toMatchObject({ averageLevel: null, isSilent: false });
    expect(track.stop).toHaveBeenCalledOnce();
  });
});
