import { OfflineIcon } from './icons.tsx';

/**
 * Offline is a state, not an incident (design pass 02 Annotation 16): one
 * neutral pill, one honest line about the single thing that is unavailable —
 * playing with friends. No red, no modal, nothing blocking. Solo and daily are
 * byte-identical online and off, so nothing else on the page changes.
 */

/** The small `Offline` pill for the Home header (surface 09a). */
export function OfflinePill() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-medium text-ink-muted">
      <OfflineIcon size={14} />
      Offline
    </span>
  );
}

/** The one-line explanation beneath the play options (surface 09a). */
export function OfflineExplainer() {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-sunken p-3">
      <span className="shrink-0 text-ink-muted">
        <OfflineIcon size={18} />
      </span>
      <p className="text-xs text-ink-muted">
        Playing with friends needs a connection. Everything else is here.
      </p>
    </div>
  );
}
