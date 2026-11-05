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
  /** The wide layout's bigger tile. */
  large?: boolean;
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
  large = false,
}: PieceTileProps) {
  // handoff-04 "Tray tiles": held lifts 3px with a 2px accent-hover ring;
  // staged is a dashed outline with an "on board" pill; dimmed is `bg` with
  // grey squares (the glyph's `tone`, set by the tray).
  const tone =
    state === 'held'
      ? '-translate-y-[3px] border-accent bg-accent/10 shadow-md ring-2 ring-accent-hover'
      : state === 'staged' || state === 'done'
        ? 'border-dashed border-accent bg-surface'
        : dimmed
          ? 'border-border bg-bg'
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
        // At least 52px (60 in the wide panel), above --spacing-touch.
        'relative flex min-h-13 min-w-13 touch-none flex-col items-center justify-center gap-1.5 rounded-lg border px-3 py-2 select-none',
        large ? 'min-h-15 min-w-15' : '',
        'cursor-grab transition-[colors,opacity,box-shadow,translate] duration-fast active:cursor-grabbing',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:cursor-not-allowed disabled:opacity-40',
        dimmed ? 'opacity-70' : '',
        tone,
      ].join(' ')}
    >
      {children}
      {state === 'staged' || state === 'done' ? (
        <span className="rounded-full bg-accent px-1.5 py-px text-[0.625rem] leading-tight font-medium text-accent-ink">
          {state === 'staged' ? 'on board' : 'painted'}
        </span>
      ) : status ? (
        <span
          className={[
            'text-xs whitespace-nowrap',
            state === 'held' ? 'font-medium text-accent-hover' : 'text-ink-muted',
          ].join(' ')}
        >
          {status}
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
  tone = 'ink',
}: {
  size: number;
  filled?: number;
  cellSize?: number;
  tone?: 'ink' | 'muted';
}) {
  return (
    <span className="flex gap-0.5" aria-hidden>
      {Array.from({ length: size }, (_, i) => (
        <span
          key={i}
          className={[
            'rounded-[2px]',
            i < filled ? 'bg-accent' : tone === 'muted' ? 'bg-ink-muted' : 'bg-ink',
          ].join(' ')}
          style={{ width: cellSize, height: cellSize }}
        />
      ))}
    </span>
  );
}
