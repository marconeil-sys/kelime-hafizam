import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '../src/db/schema';
import { addWord, clearAllData } from '../src/db/repo';
import { ReviewCandidates } from '../src/features/add/ReviewCandidates';
import { WordList } from '../src/features/words/WordList';

describe('fotoğraf adayı onay ekranı', () => {
  beforeEach(async () => {
    if (!db.isOpen()) await db.open();
    await clearAllData();
  });

  afterEach(async () => {
    await clearAllData();
  });

  it('tamamı mevcutsa 0 yeni özetini gösterir ve kayıt düğmesi açmaz', () => {
    render(<ReviewCandidates
      initialCandidates={[{
        id: 'run',
        term: 'run',
        meaningText: 'koşmak',
        source: 'page',
        confidence: 0.95,
        kind: 'existing',
        existingWordId: 1,
        selected: false,
        appendMeaning: false,
      }]}
      onClose={vi.fn()}
    />);

    expect(screen.getByText('0 yeni kelime · 1 zaten vardı')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Seçilenleri kaydet' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tamam' })).toBeInTheDocument();
  });

  it('seçilen adayı kaydeder ve Kelimelerim canlı listesinde gösterir', async () => {
    const view = render(<ReviewCandidates
      initialCandidates={[{
        id: 'walk',
        term: 'walk',
        meaningText: 'yürümek',
        source: 'page',
        confidence: 0.95,
        kind: 'new',
        selected: true,
        appendMeaning: false,
      }]}
      onClose={vi.fn()}
    />);

    await userEvent.click(screen.getByRole('button', { name: 'Seçilenleri kaydet (1)' }));
    expect(await screen.findByText(/1 yeni kelime eklendi.*toplam 1 kelime var/u)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Kelimelerime git' })).toHaveAttribute('href', '#/words');

    view.unmount();
    render(<WordList />);
    expect(await screen.findByRole('heading', { name: 'walk' })).toBeInTheDocument();
    expect(screen.getByText('yürümek')).toBeInTheDocument();
  });

  it('düzenleme sonrası oluşan tekrarı başarı özetinde bildirir', async () => {
    await addWord({ term: 'run', meanings: ['koşmak'] });
    render(<ReviewCandidates
      initialCandidates={[{
        id: 'walk',
        term: 'walk',
        meaningText: 'yürümek',
        source: 'page',
        confidence: 0.95,
        kind: 'new',
        selected: true,
        appendMeaning: false,
      }]}
      onClose={vi.fn()}
    />);

    const termInput = screen.getByRole('textbox', { name: 'İngilizce kelime' });
    await userEvent.clear(termInput);
    await userEvent.type(termInput, 'run');
    await userEvent.click(screen.getByRole('button', { name: 'Seçilenleri kaydet (1)' }));

    expect(await screen.findByText(/1 seçili kelime listede olduğu için atlandı/u)).toBeInTheDocument();
  });
});
