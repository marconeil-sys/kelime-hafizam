import userEvent from '@testing-library/user-event';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  AppUpdatePrompt,
  AppUpdateProvider,
  type RegisterServiceWorker,
  useBlockAppUpdatesWhile,
} from '../src/ui/AppUpdate';

function SessionState({ active }: { active: boolean }) {
  useBlockAppUpdatesWhile(active);
  return null;
}

describe('uygulama güncellemesi', () => {
  it('yeni sürümü otomatik uygulamaz, kullanıcı onayını bekler', async () => {
    const update = vi.fn(async () => undefined);
    let announceUpdate: (() => void) | undefined;
    const register: RegisterServiceWorker = (callbacks) => {
      announceUpdate = callbacks.onNeedRefresh;
      return update;
    };

    render(
      <AppUpdateProvider>
        <AppUpdatePrompt registerServiceWorker={register} />
      </AppUpdateProvider>,
    );

    await act(async () => undefined);
    act(() => announceUpdate?.());

    expect(screen.getByText('Yeni sürüm hazır')).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Güncelle' }));
    expect(update).toHaveBeenCalledWith(true);
  });

  it('aktif öğrenme oturumunda şeridi gizler ve oturum bitince gösterir', async () => {
    let announceUpdate: (() => void) | undefined;
    const register: RegisterServiceWorker = (callbacks) => {
      announceUpdate = callbacks.onNeedRefresh;
      return vi.fn(async () => undefined);
    };
    const { rerender } = render(
      <AppUpdateProvider>
        <SessionState active />
        <AppUpdatePrompt registerServiceWorker={register} />
      </AppUpdateProvider>,
    );
    await act(async () => undefined);
    act(() => announceUpdate?.());
    expect(screen.queryByText('Yeni sürüm hazır')).not.toBeInTheDocument();

    rerender(
      <AppUpdateProvider>
        <SessionState active={false} />
        <AppUpdatePrompt registerServiceWorker={register} />
      </AppUpdateProvider>,
    );
    expect(await screen.findByText('Yeni sürüm hazır')).toBeInTheDocument();
  });
});
