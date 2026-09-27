import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

interface UpdateGuardValue {
  learningSessionActive: boolean;
  setLearningSessionActive: (active: boolean) => void;
}

const UpdateGuardContext = createContext<UpdateGuardValue | null>(null);

export function AppUpdateProvider({ children }: { children: ReactNode }) {
  const [learningSessionActive, setLearningSessionActive] = useState(false);
  const value = useMemo(
    () => ({ learningSessionActive, setLearningSessionActive }),
    [learningSessionActive],
  );
  return (
    <UpdateGuardContext.Provider value={value}>
      {children}
    </UpdateGuardContext.Provider>
  );
}

export function useBlockAppUpdatesWhile(active: boolean): void {
  const context = useContext(UpdateGuardContext);
  const setLearningSessionActive = context?.setLearningSessionActive;
  useEffect(() => {
    setLearningSessionActive?.(active);
    return () => setLearningSessionActive?.(false);
  }, [active, setLearningSessionActive]);
}

export function AppUpdatePrompt() {
  const context = useContext(UpdateGuardContext);
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [updateApp, setUpdateApp] = useState<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (import.meta.env.MODE === 'test') return;
    let active = true;
    void import('virtual:pwa-register').then(({ registerSW }) => {
      const updateSW = registerSW({
        immediate: true,
        onNeedRefresh() {
          if (active) setNeedRefresh(true);
        },
        onOfflineReady() {
          if (active) setOfflineReady(true);
        },
        onRegisterError(error) {
          console.error('Service worker kaydedilemedi.', error);
        },
      });
      if (active) setUpdateApp(() => async () => updateSW(true));
    });
    return () => {
      active = false;
    };
  }, []);

  if (!needRefresh && !offlineReady) return null;

  const sessionActive = Boolean(context?.learningSessionActive);
  return (
    <aside className="update-toast" role="status">
      <div>
        <strong>{needRefresh ? 'Yeni sürüm hazır' : 'Çevrimdışı kullanım hazır'}</strong>
        <p>
          {needRefresh
            ? sessionActive
              ? 'Güncellemek için önce çalışma oturumunu bitirin.'
              : 'Uygulamayı güvenle güncelleyebilirsiniz.'
            : 'Uygulama ilk çevrimiçi açılıştan sonra internetsiz de açılabilir.'}
        </p>
      </div>
      {needRefresh ? (
        <button
          className="primary-button"
          type="button"
          disabled={sessionActive || !updateApp}
          onClick={() => void updateApp?.()}
        >
          Güncelle
        </button>
      ) : (
        <button className="secondary-button" type="button" onClick={() => setOfflineReady(false)}>
          Tamam
        </button>
      )}
    </aside>
  );
}
