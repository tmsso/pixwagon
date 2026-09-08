import { useLocation } from 'react-router';
import { useSoloGameStore } from '../state/soloGame.ts';
import { Button } from '../components/ui/Button.tsx';
import { RefreshIcon } from './icons.tsx';
import { usePwaStore } from './usePwaStore.ts';

/**
 * "A new version is ready" — design pass 02 surface 10 / Annotation 17.
 *
 * A banner, never a dialog, and it must not interrupt a round: while a solo
 * game is being played on `/r/:code` it stays hidden and waits for the player
 * to reach Results or Home. `registerType: 'prompt'` (vite.config.ts) is what
 * makes deferral possible — the new worker is already downloaded and simply
 * waits until `applyUpdate()` (`updateSW(true)`) activates it and reloads.
 */
export function UpdateBanner() {
  const updateReady = usePwaStore((s) => s.updateReady);
  const applyUpdate = usePwaStore((s) => s.applyUpdate);
  const status = useSoloGameStore((s) => s.status);
  const { pathname } = useLocation();

  const midRound = pathname.startsWith('/r/') && status === 'playing';
  if (!updateReady || midRound) return null;

  return (
    <div
      role="status"
      className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3"
    >
      <span className="shrink-0 text-accent-hover">
        <RefreshIcon size={18} />
      </span>
      <p className="flex-1 text-sm text-ink">A new version is ready.</p>
      <Button size="sm" onClick={applyUpdate}>
        Reload
      </Button>
    </div>
  );
}
