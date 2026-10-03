import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { addWord, clearAllData } from '../src/db/repo';
import { db } from '../src/db/schema';
import { saveAudioSettings } from '../src/db/settings';
import { SessionRunner } from '../src/features/test/SessionRunner';
import { AppUpdateProvider } from '../src/ui/AppUpdate';

describe('sesli kart akışı', () => {
  beforeEach(async () => {
    if (!db.isOpen()) await db.open();
    await clearAllData();
    await saveAudioSettings({
      accent: 'en-US',
      englishVoiceURI: '',
      turkishVoiceURI: '',
      spokenFeedback: false,
      pronunciationMode: 'gemini',
      autoAdvance: false,
    });
  });

  afterEach(async () => {
    await clearAllData();
  });

  it('elle modda tam kartı kaydeder ve doğru/doğru sonucunu Grup 1 yapar', async () => {
    const word = await addWord({ term: 'run', meanings: ['koşmak'] });
    render(
      <AppUpdateProvider>
        <SessionRunner words={[word]} mode="general" onExit={vi.fn()} />
      </AppUpdateProvider>,
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Oturumu hazırla' }));
    await userEvent.click(await screen.findByRole('button', { name: 'İlk kartı sesli başlat' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Doğru okudum' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Anlam sorusuna geç' }));
    await userEvent.type(await screen.findByRole('textbox', { name: 'Cevabınız' }), 'koşmak');
    await userEvent.click(screen.getByRole('button', { name: 'Cevabı değerlendir' }));
    expect(await screen.findByText('✓ Doğru anlam')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sonucu kaydet ve bitir' }));

    expect(await screen.findByRole('heading', { name: 'Çalışma tamamlandı' })).toBeInTheDocument();
    expect(await db.words.get(word.id)).toMatchObject({ status: 'tested', group: 1, testCount: 1 });
    expect(await db.attempts.count()).toBe(1);
  });
});
