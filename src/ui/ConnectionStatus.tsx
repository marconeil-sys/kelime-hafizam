import { useEffect, useState } from 'react';

export function ConnectionStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const updateStatus = () => setOnline(navigator.onLine);
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  return (
    <span className={`connection-pill ${online ? '' : 'connection-pill--offline'}`} role="status">
      <span aria-hidden="true">{online ? '●' : '○'}</span>
      {online ? 'Çevrimiçi' : 'Çevrimdışı'}
    </span>
  );
}

