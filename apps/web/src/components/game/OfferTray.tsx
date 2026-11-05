import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { FALLBACK_BLOB_SIZES, getPiece } from '@pixwagon/game-core';
import type { FallbackFaceId, PieceId } from '@pixwagon/game-core';
import type { PendingChoice } from '../../state/placement.ts';
import { pieceOfferView } from '../../state/offerView.ts';
import { Button } from '../ui/Button.tsx';
import { FlipIcon, TurnIcon, UndoIcon } from '../ui/icons.tsx';
import { PieceGlyph } from './PieceGlyph.tsx';
import { BlobRun, PieceTile, type PieceTileState } from './PieceTile.tsx';

/** Pointer handlers for dragging a piece out of its tile (`usePlayControls().tile`). */
export interface TileDrag {
  onPointerDown: (kind: 'pair' | 'fallback', index: number, event: ReactPointerEvent) => void;
  onPointerMove: (event: ReactPointerEvent) => void;
  onPointerUp: (event: ReactPointerEvent) => void;
  onPointerCancel: (event: ReactPointerEvent) => void;
}

export interface OfferTrayProps {
  pair: readonly [PieceId, PieceId];
  fallback: FallbackFaceId;
  pending: PendingChoice | null;
  /** The player can't act this round (done, waiting, reconnecting). */
  disabled?: boolean;
  /** A move was sent and the referee hasn't ruled: everything dims and goes
   *  inert, nothing unmounts (pass 03 note 5, reworked by BRIEF-04). */
  busy?: boolean;
  tileDrag?: TileDrag;
  /** Keyboard selection of a tile. */
  onSelect: (kind: 'pair' | 'fallback', index: number) => void;
  onUndo: () => void;
  onTurn: () => void;
  onFlip: () => void;
  canUndo: boolean;
  commit: { label: string; disabled: boolean; onCommit: () => void };
  /** Why the composed move can't be placed, in plain words. */
  problem?: string | null;
  /** "Pass the round", shown in ✓ Place's slot when no move is legal. */
  pass?: { onPass: () => void } | null;
  /** Wide layout: a taller, single-column tray in the side panel. */
  wide?: boolean;
  /** Extra content above the action bar (the "last squares" note, hints). */
  note?: ReactNode;
}

const PIECE_NAMES: Record<PieceId, string> = {
  monomino: 'One square',
  domino: 'Two squares in a line',
  'tromino-i': 'Three squares in a line',
  'tromino-l': 'Three squares, bent',
  'tetromino-i': 'Four squares in a line',
  'tetromino-o': 'Four squares, a block',
  'tetromino-t': 'Four squares, a T',
  'tetromino-s': 'Four squares, a zigzag',
  'tetromino-l': 'Four squares, an L',
};

/**
 * The round's offers as pieces in a tray, plus the action bar (pass 04,
 * BRIEF-04 "The model"). Replaces `RollControl` + `PlacementEditor`: both
 * offers stay visible all round (Annotation 13), picking a piece up from one
 * makes it the round's choice, and the other offer dims rather than vanishing.
 */
export function OfferTray({
  pair,
  fallback,
  pending,
  disabled = false,
  busy = false,
  tileDrag,
  onSelect,
  onUndo,
  onTurn,
  onFlip,
  canUndo,
  commit,
  problem,
  pass,
  wide = false,
  note,
}: OfferTrayProps) {
  const chosen = pending?.kind ?? null;
  const sizes = FALLBACK_BLOB_SIZES[fallback];
  const glyphCell = wide ? 16 : 13;
  const off = disabled || busy;

  const pairState = (index: number): PieceTileState => {
    if (pending?.kind !== 'pair') return 'idle';
    const piece = pending.pieces[index === 1 ? 1 : 0];
    if (piece.at !== null) return 'staged';
    return pending.active === index ? 'held' : 'idle';
  };
  const blobState = (index: number): PieceTileState => {
    if (pending?.kind !== 'fallback') return 'idle';
    const blob = pending.blobs[index];
    if (blob && blob.cells.length === blob.size) return 'done';
    return pending.active === index ? 'held' : 'idle';
  };
  const handlers = (kind: 'pair' | 'fallback', index: number) =>
    tileDrag && !off
      ? {
          onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) =>
            tileDrag.onPointerDown(kind, index, event),
          onPointerMove: tileDrag.onPointerMove,
          onPointerUp: tileDrag.onPointerUp,
          onPointerCancel: tileDrag.onPointerCancel,
        }
      : {};

  const isPair = chosen === 'pair';
  const holding = pending !== null;

  return (
    <div
      className={['flex flex-col gap-3', busy ? 'opacity-55' : ''].join(' ')}
      inert={busy}
      aria-busy={busy || undefined}
    >
      {/* Side by side on a phone; stacked in a tall side panel; side by side
          again in a short one (a phone held sideways), so ✓ Place stays on
          screen without scrolling the panel. */}
      <div
        className={[
          'grid gap-3',
          wide
            ? 'grid-cols-[3fr_2fr] [@media(min-height:40rem)]:grid-cols-1'
            : 'grid-cols-[3fr_2fr]',
        ].join(' ')}
      >
        <OfferGroup title="The pair" hint="place both" dimmed={chosen === 'fallback'}>
          {pair.map((pieceId, index) => {
            const pendingPiece = pending?.kind === 'pair' ? pending.pieces[index] : undefined;
            const view = pieceOfferView(pieceId, pendingPiece?.orientation);
            const state = pairState(index);
            return (
              <PieceTile
                key={`${pieceId}-${index}`}
                label={`${PIECE_NAMES[pieceId]} (${getPiece(pieceId).cells.length})`}
                state={state}
                dimmed={chosen === 'fallback'}
                large={wide}
                disabled={off}
                status={
                  state === 'held' ? 'In hand' : state === 'staged' ? 'On the board' : undefined
                }
                onKeyboardSelect={() => onSelect('pair', index)}
                {...handlers('pair', index)}
              >
                <PieceGlyph
                  cells={view.cells}
                  cellSize={glyphCell}
                  tone={chosen === 'fallback' ? 'muted' : 'accent'}
                />
              </PieceTile>
            );
          })}
        </OfferGroup>
        <OfferGroup
          title="The single"
          hint={sizes.length > 1 ? 'both groups' : undefined}
          dimmed={chosen === 'pair'}
        >
          {sizes.map((size, index) => {
            const blob = pending?.kind === 'fallback' ? pending.blobs[index] : undefined;
            const filled = blob?.cells.length ?? 0;
            const state = blobState(index);
            return (
              <PieceTile
                key={`${size}-${index}`}
                label={`${size} connected square${size === 1 ? '' : 's'}`}
                state={state}
                dimmed={chosen === 'pair'}
                large={wide}
                disabled={off}
                status={
                  state === 'done'
                    ? 'Painted'
                    : state === 'held'
                      ? filled === 0
                        ? 'Paint squares'
                        : `${size - filled} more`
                      : undefined
                }
                onKeyboardSelect={() => onSelect('fallback', index)}
                {...handlers('fallback', index)}
              >
                <BlobRun
                  size={size}
                  filled={filled}
                  cellSize={glyphCell}
                  tone={chosen === 'pair' ? 'muted' : 'ink'}
                />
              </PieceTile>
            );
          })}
        </OfferGroup>
      </div>

      {note}

      <p className="min-h-5 text-center text-sm text-ink" role="status">
        {problem ?? (holding ? '' : 'Pick a piece, then drop it on the picture.')}
      </p>

      <div className="flex items-stretch gap-2">
        <Tool label="Undo" onClick={onUndo} disabled={off || !canUndo}>
          <UndoIcon />
        </Tool>
        <Tool label="Turn" onClick={onTurn} disabled={off || !isPair}>
          <TurnIcon />
        </Tool>
        <Tool label="Flip" onClick={onFlip} disabled={off || !isPair}>
          <FlipIcon />
        </Tool>
        {pass ? (
          <Button
            size="lg"
            variant="secondary"
            className="flex-1"
            onClick={pass.onPass}
            disabled={off}
          >
            Pass the round
          </Button>
        ) : (
          <Button
            size="lg"
            className="flex-1"
            disabled={commit.disabled || off}
            onClick={commit.onCommit}
          >
            {busy ? 'Placing…' : commit.label}
          </Button>
        )}
      </div>
    </div>
  );
}

function OfferGroup({
  title,
  hint,
  dimmed,
  children,
}: {
  title: string;
  hint?: string | undefined;
  dimmed: boolean;
  children: ReactNode;
}) {
  return (
    <section className="grid content-start gap-1.5" aria-label={title}>
      <h2
        className={[
          'font-mono text-xs tracking-wide uppercase',
          dimmed ? 'text-ink-muted/70' : 'text-ink-muted',
        ].join(' ')}
      >
        {title}
        {hint ? <span className="normal-case tracking-normal"> · {hint}</span> : null}
      </h2>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

function Tool({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={[
        'flex min-h-touch min-w-touch flex-col items-center justify-center gap-0.5 rounded-lg border border-border bg-surface px-2 py-1 text-ink',
        'transition-colors duration-fast hover:bg-surface-sunken',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:cursor-not-allowed disabled:opacity-40',
      ].join(' ')}
    >
      {children}
      <span className="text-[0.6875rem] leading-none font-medium text-ink-muted">{label}</span>
    </button>
  );
}
