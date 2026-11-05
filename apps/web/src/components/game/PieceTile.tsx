import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';

export type PieceTileState = 'idle' | 'held' | 'staged' | 'done';

export interface PieceTileProps {
  /** The glyph: a `PieceGlyph` for a pair piece, a `BlobRun` for the single. */
  children: ReactNode;
  /** What the tile is, for a screen reader ("L-shaped piece, 3 squares"). */
  label: string;
  state: PieceTileState;
  /** The other offer is the round's choice: still pickable, but quieter. */
  dimmed?: boolean;
  disabled?: boolean;
  /** One short line under the glyph. */
  status?: string | undefined;
  onPointerDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerMove?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUp?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerCancel?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  /** Keyboard selection. A pointer press selects on pointer-down instead, so
   *  a click that follows a drag can't undo the drop (see OfferTray). */
  onKeyboardSelect?: () => void;
}

/**
 * One piece in the tray (pass 04, BRIEF-04 "Components"). Pressed to pick the
 * piece up, or dragged straight onto the board. States: idle, held (in hand —
 * accent ring), staged (on the board — sunken, ticked), done (a full blob),
 * dimmed (the other offer is chosen) and disabled.
 */
export function PieceTile({
  children,
  label,
  state,
  dimmed = false,
  disabled = false,
  status,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onKeyboardSelect,
}: PieceTileProps) {
  const tone =
    state === 'held'
      ? 'border-accent bg-accent/10 shadow-md ring-2 ring-accent'
      : state === 'staged' || state === 'done'
        ? 'border-border bg-surface-sunken'
        : 'border-border bg-surface hover:border-accent hover:bg-accent/5';
  return (
    <button
      type="button"
      aria-label={status ? `${label}, ${status}` : label}
      aria-pressed={state === 'held'}
      disabled={disabled}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClick={(event) => {
        // `detail` is 0 for a click made with Enter or Space.
        if (event.detail === 0) onKeyboardSelect?.();
      }}
      className={[
        'relative flex min-h-touch min-w-touch touch-none flex-col items-center justify-center gap-1.5 rounded-lg border px-3 py-2 select-none',
        'cursor-grab transition-[colors,opacity,box-shadow] duration-fast active:cursor-grabbing',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:cursor-not-allowed disabled:opacity-40',
        dimmed ? 'opacity-55' : '',
        tone,
      ].join(' ')}
    >
      {children}
      {status ? (
        <span
          className={[
            'text-xs whitespace-nowrap',
            state === 'held' ? 'font-medium text-accent-hover' : 'text-ink-muted',
          ].join(' ')}
        >
          {status}
        </span>
      ) : null}
      {state === 'staged' || state === 'done' ? (
        <span
          aria-hidden
          className="absolute top-1 right-1 grid size-4 place-items-center rounded-full bg-accent text-[0.6rem] leading-none text-accent-ink"
        >
          ✓
        </span>
      ) : null}
    </button>
  );
}

/**
 * A single blob as a connected run of squares; `filled` of them painted. The
 * same connected-run look as `DiceFace` (pass 04: never separated dots).
 */
export function BlobRun({
  size,
  filled = 0,
  cellSize = 14,
}: {
  size: number;
  filled?: number;
  cellSize?: number;
}) {
  return (
    <span className="flex gap-0.5" aria-hidden>
      {Array.from({ length: size }, (_, i) => (
        <span
          key={i}
          className={['rounded-[2px]', i < filled ? 'bg-accent' : 'bg-ink'].join(' ')}
          style={{ width: cellSize, height: cellSize }}
        />
      ))}
    </span>
  );
}
