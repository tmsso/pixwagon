import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // vite-plugin-pwa wraps Workbox (the ROADMAP Phase 3 "service worker via
    // Workbox" line). `generateSW` builds the precache manifest from the build
    // output; `registerType: 'prompt'` means a new version installs in the
    // background and waits — the app decides when to activate it, which is how
    // the update banner can hold until the results screen (Annotation 17).
    VitePWA({
      registerType: 'prompt',
      // The static manifest at public/manifest.webmanifest is hand-maintained
      // and already linked from index.html — don't let the plugin generate a
      // second one.
      manifest: false,
      // Precache the icons too; the shipped pack is a static JSON import already
      // bundled into the JS chunk, so globbing the build output covers it.
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        // Offline deep links (/r/solo, /results) resolve to the cached shell,
        // mirroring the Cloudflare Pages _redirects rule for the online case.
        navigateFallback: '/index.html',
        // ...but never shadow the API — those must reach the network (Phase 4
        // adds /api/room on the worker origin; belt-and-suspenders here).
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
      // No service worker under `pnpm dev` — it only complicates HMR, and the
      // offline story is verified against the real Pages build anyway.
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5173,
  },
  build: {
    // Pixel art and a small rule set — the whole point is that this stays tiny
    // enough to install as a PWA over a phone connection.
    target: 'es2022',
  },
});
