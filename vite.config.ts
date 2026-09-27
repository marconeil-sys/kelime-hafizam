import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

export function githubPagesBase(
  repository = process.env.GITHUB_REPOSITORY,
  explicitBase = process.env.VITE_BASE_PATH,
): string {
  if (explicitBase) {
    return explicitBase.endsWith('/') ? explicitBase : `${explicitBase}/`;
  }

  const repositoryName = repository?.split('/')[1];
  if (!repositoryName || repositoryName.endsWith('.github.io')) return '/';
  return `/${repositoryName}/`;
}

export default defineConfig({
  base: githubPagesBase(),
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        id: './',
        name: 'Kelime Hafızam',
        short_name: 'Kelimelerim',
        description: 'İngilizce kelimelerinizi ekleyin, sesli çalışın ve ilerlemenizi izleyin.',
        lang: 'tr',
        start_url: './#/add',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f7f7fc',
        theme_color: '#4f46e5',
        categories: ['education', 'productivity'],
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false,
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        navigateFallback: 'index.html',
      },
      devOptions: {
        enabled: process.env.PWA_DEV === 'true',
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    css: true,
  },
});
