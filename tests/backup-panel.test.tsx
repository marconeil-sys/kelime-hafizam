import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { addWord, clearAllData } from '../src/db/repo';
import { db } from '../src/db/schema';
import { BackupPanel } from '../src/features/settings/BackupPanel';

describe('yedek paneli', () => {
  beforeEach(async () => {
    if (!db.isOpen()) await db.open();
    await clearAllData();
  });

  afterEach(async () => {
    await clearAllData();
  });

  it('kelime listesi değişince hazırlanmış eski yedeği iptal eder', async () => {
    render(<BackupPanel />);
    await userEvent.click(screen.getByRole('button', { name: 'Yedeği hazırla' }));
    expect(await screen.findByRole('button', { name: 'Kaydet / Paylaş' })).toBeInTheDocument();

    await addWord({ term: 'fresh', meanings: ['taze'] });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Kaydet / Paylaş' })).not.toBeInTheDocument();
    });
    expect(screen.getByText('Kelime listeniz değişti. Güncel bir yedek hazırlayın.')).toBeInTheDocument();
  });
});
