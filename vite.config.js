import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://lightpink-pigeon-633801.hostingersite.com',
        changeOrigin: true,
      },
    },
  },
});