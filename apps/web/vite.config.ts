import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
  },
  build: {
    // Pixel art and a small rule set — the whole point is that this stays tiny
    // enough to install as a PWA over a phone connection.
    target: 'es2022',
  },
});
