/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // In dev the frontend runs on Vite (5173) and the API on the Node server
  // (8787). Proxy /api across so the browser always calls a same-origin path,
  // exactly like production where one server serves both.
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
});
