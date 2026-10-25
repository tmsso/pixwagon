import { useState } from 'react';
import { Button } from '../components/ui/Button.tsx';
import { InstallIcon } from '../components/ui/icons.tsx';
import { isCardVisible, isGhostVisible } from './installState.ts';
import { needsManualInstall, readPlatform } from './platform.ts';
import { usePwaStore } from './usePwaStore.ts';

/** What to do by hand on iOS: the Share button is the browser's own, so it is
 *  named, not drawn (an icon of ours would only look like it). */
const MANUAL_STEPS = 'Tap the Share button, then Add to Home Screen.';

/**
 * The install prompt, surfaces 08a (full card) and 08b (quiet ghost button),
 * per design pass 02 Annotation 16.
 *
 * Only ever rendered on Home and Results, and only after a completed picture
 * has made the prompt `eligible` — never on first load. Hidden entirely when
 * the platform hasn't offered an install (`deferredPrompt` null) — except on
 * iOS, where "Add to Home Screen" is a manual Share-sheet action with no
 * `beforeinstallprompt` to hook: there the same card (and ghost button) says
 * how, in words, instead of offering a button that couldn't work.
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
  // Read once: a phone doesn't change platform while the page is open.
  const [manual] = useState(() => {
    const facts = readPlatform();
    return facts !== null && needsManualInstall(facts);
  });
  const [showHow, setShowHow] = useState(false);

  if (!canInstall && !manual) return null;

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
              {manual
                ? `${MANUAL_STEPS} Solo and daily keep working with no signal.`
                : 'Opens instantly, and solo and daily keep working with no signal.'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {manual ? null : (
            <Button className="flex-1" onClick={() => void promptInstall()}>
              Add to home screen
            </Button>
          )}
          <Button
            variant={manual ? 'secondary' : 'ghost'}
            className={manual ? 'flex-1' : ''}
            onClick={dismissInstall}
          >
            {manual ? 'Got it' : 'Not now'}
          </Button>
        </div>
      </section>
    );
  }

  if (isGhostVisible(installState, now)) {
    return (
      <div className="flex flex-col items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={manual ? showHow : undefined}
          onClick={() => (manual ? setShowHow((open) => !open) : void promptInstall())}
        >
          <InstallIcon size={16} />
          {manual ? 'How to add to home screen' : 'Add to home screen'}
        </Button>
        {manual && showHow ? (
          <p className="text-center text-sm text-ink-muted">{MANUAL_STEPS}</p>
        ) : null}
      </div>
    );
  }

  return null;
}
