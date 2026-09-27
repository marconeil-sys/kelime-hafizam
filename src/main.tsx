import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';
import './styles.css';

if ('storage' in navigator && 'persist' in navigator.storage) {
  void navigator.storage.persist();
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
