import { describe, expect, it, vi } from 'vitest';

import { calculateResizeDimensions, resizeImage } from '../src/services/image';

describe('fotoğraf küçültme', () => {
  it('en uzun kenarı 2000 piksele indirir ve küçük görüntüyü büyütmez', () => {
    expect(calculateResizeDimensions(4000, 2000)).toEqual({ width: 2000, height: 1000 });
    expect(calculateResizeDimensions(1200, 800)).toEqual({ width: 1200, height: 800 });
  });

  it('JPEG yüzde 85 üretir ve çözülmüş görüntüyü kapatır', async () => {
    const drawImage = vi.fn();
    const close = vi.fn();
    const toBlob = vi.fn((callback: BlobCallback, type?: string, quality?: number) => {
      expect(type).toBe('image/jpeg');
      expect(quality).toBe(0.85);
      callback({ arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer } as Blob);
    });
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage }),
      toBlob,
    } as unknown as HTMLCanvasElement;
    const file = new File(['fake'], 'page.heic', { type: 'image/heic' });

    const result = await resizeImage(file, {
      decode: async () => ({ width: 3000, height: 1500, source: {} as CanvasImageSource, close }),
      createCanvas: () => canvas,
    });

    expect(result).toMatchObject({ width: 2000, height: 1000, mimeType: 'image/jpeg' });
    expect(result.base64Data).toBe('AQID');
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 2000, 1000);
    expect(close).toHaveBeenCalledOnce();
  });
});
