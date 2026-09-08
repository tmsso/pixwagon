import { registerSW } from 'virtual:pwa-register';
import { usePwaStore, type BeforeInstallPromptEvent } from './usePwaStore.ts';

/**
 * Browser-only side effects for the PWA: register the service worker, and wire
 * the platform install / update events into `usePwaStore`. Imported once by
 * `main.tsx`. Never imported by a route component — that would pull
 * `virtual:pwa-register` into the Node render in scripts/check-screens.tsx.
 */

// `registerType: 'prompt'` (vite.config.ts): a new worker installs and waits.
// `updateSW(true)` is what actually skips-waiting and reloads — handed to the
// store so the update banner's "Reload" button can call it when it's safe.
const updateSW = registerSW({
  onNeedRefresh() {
    usePwaStore.getState().setUpdateReady(true);
  },
  // A silent offline-ready: no toast. Offline is a state, not an event worth
  // interrupting for (Annotation 16).
  onOfflineReady() {},
});

usePwaStore.getState().setApplyUpdate(() => {
  void updateSW(true);
});

window.addEventListener('beforeinstallprompt', (event) => {
  // Keep the browser's own mini-infobar from showing; we surface the prompt
  // ourselves, only after a completed picture (Annotation 16).
  event.preventDefault();
  usePwaStore.getState().setDeferredPrompt(event as BeforeInstallPromptEvent);
});

window.addEventListener('appinstalled', () => {
  usePwaStore.getState().onInstalled();
});

// Already installed and launched from the home screen — nothing install-related
// should show.
if (window.matchMedia('(display-mode: standalone)').matches) {
  usePwaStore.getState().onInstalled();
}
