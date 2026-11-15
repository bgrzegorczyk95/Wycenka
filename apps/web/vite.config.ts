import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** WORKER_PORT lets a second instance run next to `pnpm dev` (e.g. browser tests on 5174/8788). */
const worker = `http://localhost:${process.env.WORKER_PORT ?? '8787'}`;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': worker,
      '/o/': worker,
    },
  },
});
