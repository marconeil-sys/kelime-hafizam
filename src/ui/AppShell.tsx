import { NavLink, Outlet } from 'react-router-dom';

import { AppUpdatePrompt } from './AppUpdate';
import { ConnectionStatus } from './ConnectionStatus';

const navigation = [
  { to: '/add', label: 'Ekle', icon: '＋' },
  { to: '/test', label: 'Test', icon: '▶' },
  { to: '/words', label: 'Kelimelerim', icon: 'Aa' },
  { to: '/settings', label: 'Ayarlar', icon: '⚙' },
] as const;

export function AppShell() {
  return (
    <div className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">Kişisel çalışma alanın</p>
          <h1>Kelime Hafızam</h1>
        </div>
        <ConnectionStatus />
      </header>

      <main className="page-content">
        <Outlet />
      </main>

      <AppUpdatePrompt />

      <nav className="bottom-nav" aria-label="Ana gezinme">
        {navigation.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`}
          >
            <span className="nav-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
