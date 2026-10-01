import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { clearAllData, addWord } from '../src/db/repo';
import { db } from '../src/db/schema';
import { TestTabs } from '../src/features/test/TestTabs';

describe('Test sekmesi yer tutucusu', () => {
  beforeEach(async () => {
    if (!db.isOpen()) await db.open();
    await clearAllData();
  });

  afterEach(async () => {
    await clearAllData();
  });

  it('kayıtlı kelime sayısını gösterir ve sesli akışın sonraki aşama olduğunu açıklar', async () => {
    await addWord({ term: 'walk', meanings: ['yürümek'] });
    render(<TestTabs />);

    expect(await screen.findByRole('heading', { name: '1 kayıtlı kelime hazır' })).toBeInTheDocument();
    expect(screen.getByText(/Sesli flashcard ve grup testleri Aşama 5–6/u)).toBeInTheDocument();
  });
});
