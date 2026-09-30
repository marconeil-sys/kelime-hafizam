import { backupFileName, buildBackup, recordBackupCreated } from '../../db/backup';

export interface BackupSaveEnvironment {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
  download: (file: File) => void;
  recordSuccess: () => Promise<void>;
}

export async function prepareBackupFile(): Promise<File> {
  const backup = await buildBackup();
  return new File([JSON.stringify(backup, null, 2)], backupFileName(), {
    type: 'application/json',
  });
}

function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function browserEnvironment(): BackupSaveEnvironment {
  return {
    share: typeof navigator.share === 'function' ? navigator.share.bind(navigator) : undefined,
    canShare: typeof navigator.canShare === 'function' ? navigator.canShare.bind(navigator) : undefined,
    download: downloadFile,
    recordSuccess: recordBackupCreated,
  };
}

export async function savePreparedBackup(
  file: File,
  environment: BackupSaveEnvironment = browserEnvironment(),
): Promise<'shared' | 'downloaded'> {
  const shareData: ShareData = { files: [file], title: 'Kelime Hafızam yedeği' };
  const canShareFile = Boolean(environment.share && environment.canShare?.(shareData));

  if (canShareFile) {
    // The share sheet is opened before the first await so iOS keeps the tap gesture active.
    const shareOperation = environment.share!(shareData);
    await shareOperation;
    await environment.recordSuccess();
    return 'shared';
  }

  environment.download(file);
  await environment.recordSuccess();
  return 'downloaded';
}
