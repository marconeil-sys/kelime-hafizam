import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ReviewCandidates } from '../src/features/add/ReviewCandidates';

describe('fotoğraf adayı onay ekranı', () => {
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
});
