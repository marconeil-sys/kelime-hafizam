import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

interface UpdateGuardValue {
  learningSessionActive: boolean;
  setLearningSessionActive: (active: boolean) => void;
}

interface ServiceWorkerCallbacks {
  immediate: boolean;
  onNeedRefresh: () => void;
  onOfflineReady: () => void;
  onRegisterError: (error: unknown) => void;
}

export type RegisterServiceWorker = (
  callbacks: ServiceWorkerCallbacks,
) => (reloadPage?: boolean) => Promise<void>;

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

export function AppUpdatePrompt({
  registerServiceWorker,
}: {
  registerServiceWorker?: RegisterServiceWorker;
} = {}) {
  const context = useContext(UpdateGuardContext);
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [updateApp, setUpdateApp] = useState<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (import.meta.env.MODE === 'test' && !registerServiceWorker) return;
    let active = true;
    const setup = async () => {
      const registerSW = registerServiceWorker ?? (await import('virtual:pwa-register')).registerSW;
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
    };
    void setup();
    return () => {
      active = false;
    };
  }, [registerServiceWorker]);

  if (!needRefresh && !offlineReady) return null;

  const sessionActive = Boolean(context?.learningSessionActive);
  if (needRefresh && sessionActive) return null;
  return (
    <aside className="update-toast" role="status">
      <div>
        <strong>{needRefresh ? 'Yeni sürüm hazır' : 'Çevrimdışı kullanım hazır'}</strong>
        <p>
          {needRefresh
            ? 'Uygulamayı güvenle güncelleyebilirsiniz.'
            : 'Uygulama ilk çevrimiçi açılıştan sonra internetsiz de açılabilir.'}
        </p>
      </div>
      {needRefresh ? (
        <button
          className="primary-button"
          type="button"
          disabled={!updateApp}
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
