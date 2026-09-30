import { describe, expect, it, vi } from 'vitest';

import { savePreparedBackup } from '../src/features/settings/backupFile';

describe('hazır yedek dosyasını kaydetme', () => {
  it('NotAllowedError olduğunda başarı tarihini yazmaz ve indirmeye düşmez', async () => {
    const recordSuccess = vi.fn(async () => undefined);
    const download = vi.fn();
    const share = vi.fn(() => Promise.reject(new DOMException('gesture lost', 'NotAllowedError')));
    const file = new File(['{}'], 'yedek.json', { type: 'application/json' });

    await expect(savePreparedBackup(file, {
      share,
      canShare: () => true,
      download,
      recordSuccess,
    })).rejects.toMatchObject({ name: 'NotAllowedError' });

    expect(share).toHaveBeenCalledOnce();
    expect(download).not.toHaveBeenCalled();
    expect(recordSuccess).not.toHaveBeenCalled();
  });

  it('dosya paylaşımı desteklenmiyorsa indirmeyi başlatıp tarihi yazar', async () => {
    const recordSuccess = vi.fn(async () => undefined);
    const download = vi.fn();
    const file = new File(['{}'], 'yedek.json', { type: 'application/json' });

    await expect(savePreparedBackup(file, { download, recordSuccess })).resolves.toBe('downloaded');
    expect(download).toHaveBeenCalledWith(file);
    expect(recordSuccess).toHaveBeenCalledOnce();
  });
});
