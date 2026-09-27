import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from '../src/App';

describe('uygulama iskeleti', () => {
  it('dört ana sekmeyi ve varsayılan Ekle ekranını gösterir', async () => {
    window.location.hash = '#/add';
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Çalışma listeni oluştur' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ekle/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Test/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Kelimelerim/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ayarlar/ })).toBeInTheDocument();
  });

  it('bilinmeyen bir adresi Ekle ekranına yönlendirir', async () => {
    window.location.hash = '#/olmayan-sayfa';
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Çalışma listeni oluştur' })).toBeInTheDocument();
  });
});
