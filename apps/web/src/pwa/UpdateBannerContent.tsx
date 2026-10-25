import type { ReactNode } from 'react';
import { RefreshIcon } from '../components/ui/icons.tsx';

/**
 * The inside of the "A new version is ready" banner: icon, line, one action.
 * Shared between the live banner (`UpdateBanner`, a real button) and the
 * static picture of it on the "this room needs an update" screen (pass 03
 * `02g2`, note 14), so the player recognises on Home exactly what they were
 * shown — and the two can't drift apart.
 */
export function UpdateBannerContent({ action }: { action: ReactNode }) {
  return (
    <>
      <span className="shrink-0 text-accent-hover">
        <RefreshIcon size={18} />
      </span>
      <p className="flex-1 text-sm text-ink">A new version is ready.</p>
      {action}
    </>
  );
}
