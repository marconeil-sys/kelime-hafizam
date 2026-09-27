import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AddScreen } from './features/add/AddScreen';
import { SettingsScreen } from './features/settings/SettingsScreen';
import { TestTabs } from './features/test/TestTabs';
import { WordList } from './features/words/WordList';
import { AppShell } from './ui/AppShell';
import { AppUpdateProvider } from './ui/AppUpdate';

export function App() {
  return (
    <AppUpdateProvider>
      <HashRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/add" element={<AddScreen />} />
            <Route path="/test" element={<TestTabs />} />
            <Route path="/words" element={<WordList />} />
            <Route path="/settings" element={<SettingsScreen />} />
            <Route index element={<Navigate replace to="/add" />} />
            <Route path="*" element={<Navigate replace to="/add" />} />
          </Route>
        </Routes>
      </HashRouter>
    </AppUpdateProvider>
  );
}
