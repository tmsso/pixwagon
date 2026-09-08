import { create } from 'zustand';
import {
  dismiss,
  INITIAL_INSTALL_STATE,
  markEligible,
  markInstalled,
  parseInstallState,
  type InstallState,
} from './installState.ts';

/**
 * PWA-only client state — install-prompt lifecycle and the "new version ready"
 * flag. Kept in its own store, separate from `soloGame` and from the future
 * `RoomState` store (ROADMAP.md Phase 2 note): install/update state is
 * orthogonal to gameplay and to multiplayer.
 *
 * `virtual:pwa-register` is deliberately not imported here — that lives in
 * `pwa/register.ts`, which `main.tsx` pulls in as a browser-only side effect.
 * Keeping it out means route components can read this store under
 * `renderToStaticMarkup` (scripts/check-screens.tsx) without dragging the
 * service-worker registration into Node.
 */

const STORAGE_KEY = 'pixwagon.installPrompt';

/**
 * The `beforeinstallprompt` event, which the platform fires when the app is
 * installable. Not in the DOM lib types yet, so a minimal local shape.
 */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function loadInstallState(): InstallState {
  if (typeof localStorage === 'undefined') return INITIAL_INSTALL_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? parseInstallState(JSON.parse(raw)) : INITIAL_INSTALL_STATE;
  } catch {
    // Private-mode quota errors, malformed JSON — treat as a fresh prompt.
    return INITIAL_INSTALL_STATE;
  }
}

function persistInstallState(state: InstallState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Best effort — a device that can't persist just re-asks next session.
  }
}

interface PwaStore {
  installState: InstallState;
  /** The deferred platform prompt, captured from `beforeinstallprompt`. Null
   *  until the platform offers it (and always null on iOS Safari, which has no
   *  such event — the install card stays hidden there for now). */
  deferredPrompt: BeforeInstallPromptEvent | null;
  /** A newer service worker is waiting. Set true unconditionally on
   *  `onNeedRefresh`; where the banner actually renders is gated by the caller
   *  so it can hold until the results screen (Annotation 17). */
  updateReady: boolean;
  /** Activates the waiting worker and reloads. Replaced by `pwa/register.ts`
   *  with the real `updateSW(true)`; a no-op until then. */
  applyUpdate: () => void;

  setDeferredPrompt: (event: BeforeInstallPromptEvent | null) => void;
  setUpdateReady: (ready: boolean) => void;
  setApplyUpdate: (fn: () => void) => void;

  /** Called once when a picture is completed — promotes an unseen prompt to
   *  eligible so the card can appear on the next Home visit. */
  onPictureCompleted: () => void;
  /** "Add to home screen" — fires the platform prompt, then clears our card on
   *  either outcome (accepted installs; dismissed here is the OS dialog, not
   *  our "Not now", so it does not count toward retiring). */
  promptInstall: () => Promise<void>;
  /** Our own "Not now". */
  dismissInstall: () => void;
  /** `appinstalled` fired, or we launched in standalone display mode. */
  onInstalled: () => void;
}

export const usePwaStore = create<PwaStore>((set, get) => ({
  installState: loadInstallState(),
  deferredPrompt: null,
  updateReady: false,
  applyUpdate: () => {},

  setDeferredPrompt: (event) => set({ deferredPrompt: event }),
  setUpdateReady: (ready) => set({ updateReady: ready }),
  setApplyUpdate: (fn) => set({ applyUpdate: fn }),

  onPictureCompleted: () => {
    const next = markEligible(get().installState);
    if (next === get().installState) return;
    persistInstallState(next);
    set({ installState: next });
  },

  promptInstall: async () => {
    const event = get().deferredPrompt;
    if (!event) return;
    await event.prompt();
    await event.userChoice;
    // One-shot event — it can't be prompted twice.
    set({ deferredPrompt: null });
  },

  dismissInstall: () => {
    const next = dismiss(get().installState, Date.now());
    persistInstallState(next);
    set({ installState: next });
  },

  onInstalled: () => {
    const next = markInstalled();
    persistInstallState(next);
    set({ installState: next, deferredPrompt: null });
  },
}));
