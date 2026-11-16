import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/** WORKER_PORT lets a second instance run next to `pnpm dev` (e.g. browser tests on 5174/8788). */
const worker = `http://localhost:${process.env.WORKER_PORT ?? '8787'}`;

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // PWA: the app shell is cached so the visit screen opens without signal (docs/03 „Offline”).
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'Wycenka',
        short_name: 'Wycenka',
        description: 'Oferta dla klienta w 2 minuty. Prosto z oględzin.',
        lang: 'pl',
        start_url: '/oferty',
        display: 'standalone',
        background_color: '#F5F3EE',
        theme_color: '#F5F3EE',
        // Final PNG icons come with M10 (store-quality assets); SVG works in Chrome/Android.
        icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        // Latin fonts only (Polish) – other scripts load on demand if ever needed.
        globPatterns: ['**/*.{js,css,html,svg}', '**/*latin*.woff2'],
        navigateFallback: '/index.html',
        // API calls and the server-rendered client page always go to the network.
        navigateFallbackDenylist: [/^\/api\//, /^\/o\//],
        runtimeCaching: [],
      },
    }),
  ],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': worker,
      '/o/': worker,
    },
  },
});
