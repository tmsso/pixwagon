import { useState } from 'react';
import { Button } from '../components/ui/Button.tsx';
import { InstallIcon } from './icons.tsx';
import { isCardVisible, isGhostVisible } from './installState.ts';
import { usePwaStore } from './usePwaStore.ts';

/**
 * The install prompt, surfaces 08a (full card) and 08b (quiet ghost button),
 * per design pass 02 Annotation 16.
 *
 * Only ever rendered on Home and Results, and only after a completed picture
 * has made the prompt `eligible` — never on first load. Hidden entirely when
 * the platform hasn't offered an install (`deferredPrompt` null): that includes
 * iOS Safari, where "Add to Home Screen" is a manual Share-sheet action with no
 * `beforeinstallprompt` to hook.
 */
export function InstallPrompt() {
  const installState = usePwaStore((s) => s.installState);
  const canInstall = usePwaStore((s) => s.deferredPrompt !== null);
  const promptInstall = usePwaStore((s) => s.promptInstall);
  const dismissInstall = usePwaStore((s) => s.dismissInstall);

  // Read the clock once at mount (lazy init keeps it out of render purity
  // rules). The only boundary it gates is a 30-day suppression lapsing — not
  // something that needs to flip mid-view.
  const [now] = useState(() => Date.now());

  if (!canInstall) return null;

  if (isCardVisible(installState, now)) {
    return (
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="shrink-0 text-accent-hover">
            <InstallIcon size={24} />
          </span>
          <div>
            <p className="font-medium text-ink">Keep Pixwagon on your home screen</p>
            <p className="text-sm text-ink-muted">
              Opens instantly, and solo and daily keep working with no signal.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => void promptInstall()}>
            Add to home screen
          </Button>
          <Button variant="ghost" onClick={dismissInstall}>
            Not now
          </Button>
        </div>
      </section>
    );
  }

  if (isGhostVisible(installState, now)) {
    return (
      <div className="flex justify-center">
        <Button variant="ghost" size="sm" onClick={() => void promptInstall()}>
          <InstallIcon size={16} />
          Add to home screen
        </Button>
      </div>
    );
  }

  return null;
}
