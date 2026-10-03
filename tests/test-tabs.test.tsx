import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { clearAllData, addWord } from '../src/db/repo';
import { db } from '../src/db/schema';
import { poolForMode, TestTabs } from '../src/features/test/TestTabs';

describe('Test sekmesi', () => {
  beforeEach(async () => {
    if (!db.isOpen()) await db.open();
    await clearAllData();
  });

  afterEach(async () => {
    await clearAllData();
  });

  it('Genel Tarama havuzunu ve çalışma açma düğmesini gösterir', async () => {
    await addWord({ term: 'walk', meanings: ['yürümek'] });
    render(<TestTabs />);

    expect(await screen.findByRole('heading', { name: '1 kelime hazır' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Çalışmayı aç' })).toBeInTheDocument();
  });

  it('havuzları grup durumuna göre ayırır', async () => {
    const fresh = await addWord({ term: 'fresh', meanings: ['taze'] });
    const learned = { ...fresh, id: fresh.id + 1, term: 'known', normalizedTerm: 'known', status: 'tested' as const, group: 1 as const };
    const weak = { ...fresh, id: fresh.id + 2, term: 'weak', normalizedTerm: 'weak', status: 'tested' as const, group: 3 as const };
    expect(poolForMode([fresh, learned, weak], 'general').map((word) => word.term)).toEqual(['fresh', 'weak']);
    expect(poolForMode([fresh, learned, weak], 'daily').map((word) => word.term)).toEqual(['weak']);
    expect(poolForMode([fresh, learned, weak], 'mastered').map((word) => word.term)).toEqual(['known']);
  });
});
