/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  envDir: path.resolve(__dirname, '..'),
  // GitHub Pages project page serves from /whiteboard-fe/, not /. Only the
  // CI build sets GITHUB_PAGES; local dev and preview stay at '/'.
  base: process.env.GITHUB_PAGES ? '/whiteboard-fe/' : '/',
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      exclude: ['node_modules', 'dist'],
    },
  },
});
