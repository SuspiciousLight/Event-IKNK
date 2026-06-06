import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: ['localhost', '127.0.0.1', '.trycloudflare.com', '.loca.lt'],
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_API_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
    allowedHosts: ['localhost', '127.0.0.1', '.trycloudflare.com', '.loca.lt'],
  },
  resolve: {
    alias: {
      '@diplom/shared': resolve(__dirname, '../../packages/shared/src'),
    },
  },
});
