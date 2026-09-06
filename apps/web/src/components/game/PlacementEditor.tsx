import type { ReactNode } from 'react';
import type { PendingChoice } from '../../state/placement.ts';
import { pieceOfferView } from '../../state/offerView.ts';
import { Button } from '../ui/Button.tsx';
import { DiceFace, type FallbackFace } from './DiceFace.tsx';
import { PieceGlyph } from './PieceGlyph.tsx';

export interface PlacementEditorProps {
  pending: PendingChoice;
  /** Commit-button label ("Place N squares") and whether it's live yet —
   *  computed by the caller from `pendingCellCount` / `isPendingComplete`. */
  commitLabel: string;
  commitDisabled: boolean;
  onSetActive: (index: number) => void;
  /** Turn — rotates the active piece 90°. Pair only. */
  onRotate: () => void;
  /** Flip — mirrors the active piece. Pair only. */
  onMirror: () => void;
  /** Take back — clears the active piece's origin or the active blob's cells.
   *  The undo-before-commit path; leaves the rest of the choice intact. */
  onTakeBack: () => void;
  /** Switch / Cancel — both abandon the whole pending choice and return to the
   *  offers. They're one action here (solo has no partial "keep the offer but
   *  drop the placement" state); the chosen-offer bar's "Switch" is just a
   *  discoverable second entry point to it. */
  onCancel: () => void;
  onCommit: () => void;
}

/**
 * The composition sheet (design pass 02, Surface 07 + Annotation 09). Contents
 * top to bottom: the chosen-offer bar (which offer is being composed, plus
 * Switch), a radiogroup of the pieces/blobs, the tool row, and the commit row.
 * The 284px sheet chrome — grip, scrim, fixed height — is `HudFrame`'s `sheet`
 * slot; this is only what goes inside it.
 *
 * Exact 10–11px label sizes and 0.08em tracking from the spec are approximated
 * to the `xs`/`wide` tokens: this repo styles with utility classes, not
 * arbitrary pixel values.
 */
export function PlacementEditor({
  pending,
  commitLabel,
  commitDisabled,
  onSetActive,
  onRotate,
  onMirror,
  onTakeBack,
  onCancel,
  onCommit,
}: PlacementEditorProps) {
  const isPair = pending.kind === 'pair';
  const anythingPlaced = isPair
    ? pending.pieces.some((piece) => piece.origin !== null)
    : pending.blobs.some((blob) => blob.cells.length > 0);

  return (
    <div className="flex flex-col gap-3">
      <ChosenOfferBar pending={pending} onSwitch={onCancel} />

      {isPair ? (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Piece to place">
          {pending.pieces.map((piece, index) => (
            <PieceOrBlobCard
              key={index}
              active={pending.active === index}
              placed={piece.origin !== null}
              onSelect={() => onSetActive(index)}
              status={
                piece.origin
                  ? 'On the board'
                  : pending.active === index
                    ? 'Tap the board'
                    : 'Not placed'
              }
            >
              <PieceGlyph {...pieceOfferView(piece.pieceId, piece.orientation)} />
            </PieceOrBlobCard>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Blob to place">
          {pending.blobs.map((blob, index) => {
            const remaining = blob.size - blob.cells.length;
            return (
              <PieceOrBlobCard
                key={index}
                active={pending.active === index}
                placed={remaining === 0}
                onSelect={() => onSetActive(index)}
                status={
                  remaining === 0
                    ? `${blob.size} of ${blob.size} · done`
                    : `${remaining} more square${remaining === 1 ? '' : 's'}`
                }
              >
                <span className="flex items-center gap-1">
                  {Array.from({ length: blob.size }, (_, k) => (
                    <span
                      key={k}
                      className={[
                        'block size-2 rounded-sm',
                        k < blob.cells.length ? 'bg-accent' : 'bg-border',
                      ].join(' ')}
                    />
                  ))}
                </span>
              </PieceOrBlobCard>
            );
          })}
        </div>
      )}

      {isPair ? (
        <div className="grid grid-cols-3 gap-2">
          <Tool label="Turn" onClick={onRotate} icon={<TurnIcon />} />
          <Tool label="Flip" onClick={onMirror} icon={<FlipIcon />} />
          <Tool
            label="Take back"
            onClick={onTakeBack}
            disabled={!anythingPlaced}
            icon={<TakeBackIcon />}
          />
        </div>
      ) : (
        // A blob has no orientation, so the single only ever gets Take back.
        <div className="grid gap-2">
          <Tool
            label="Take back"
            onClick={onTakeBack}
            disabled={!anythingPlaced}
            icon={<TakeBackIcon />}
          />
        </div>
      )}

      <div className="flex gap-2">
        <Button size="lg" className="flex-1" disabled={commitDisabled} onClick={onCommit}>
          {commitLabel}
        </Button>
        <Button size="lg" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function ChosenOfferBar({ pending, onSwitch }: { pending: PendingChoice; onSwitch: () => void }) {
  return (
    <div className="flex min-h-touch items-center gap-2.5 rounded-lg border border-accent bg-accent/10 px-3 py-1.5">
      <span className="font-mono text-xs uppercase tracking-wide text-ink-muted">
        {pending.kind === 'pair' ? 'The pair' : 'The single'}
      </span>
      {pending.kind === 'pair' ? (
        <span className="flex gap-1.5">
          {pending.pieces.map((piece, index) => (
            <PieceGlyph key={index} {...pieceOfferView(piece.pieceId)} />
          ))}
        </span>
      ) : (
        <DiceFace face={blobSizesToFace(pending.blobs)} size="sm" />
      )}
      <button
        type="button"
        onClick={onSwitch}
        className="ml-auto rounded text-sm font-medium text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Switch
      </button>
    </div>
  );
}

function PieceOrBlobCard({
  active,
  placed,
  status,
  onSelect,
  children,
}: {
  active: boolean;
  placed: boolean;
  status: string;
  onSelect: () => void;
  children: ReactNode;
}) {
  // Design pass 02 states: active → accent border + tint + shadow, status line
  // in accent-hover/500; placed-not-active → sunken; neither → plain surface.
  const tone = active
    ? 'border-accent bg-accent/10 shadow-sm'
    : placed
      ? 'border-border bg-surface-sunken'
      : 'border-border bg-surface';
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      className={[
        'flex min-h-touch flex-1 flex-col items-center justify-center gap-1 rounded-lg border px-3 py-2',
        'transition-colors duration-fast',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        tone,
      ].join(' ')}
    >
      {children}
      <span
        className={['text-xs', active ? 'font-medium text-accent-hover' : 'text-ink-muted'].join(
          ' ',
        )}
      >
        {status}
      </span>
    </button>
  );
}

function Tool({
  label,
  icon,
  onClick,
  disabled = false,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={[
        'flex min-h-touch flex-col items-center justify-center gap-0.5 rounded-lg border border-border bg-surface px-2 py-1.5 text-ink',
        'transition-colors duration-fast hover:bg-surface-sunken',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:cursor-not-allowed disabled:opacity-40',
      ].join(' ')}
    >
      {icon}
      {/* The label is the accessible name too (aria-label mirrors it) — no
          tooltip-only affordances, per the spec. */}
      <span className="text-xs font-medium text-ink-muted">{label}</span>
    </button>
  );
}

/** Rebuild the `DiceFace` display shape from the pending blobs' sizes — one
 *  number for a single blob, a 2-tuple for a compound face. Saves threading the
 *  round's `FallbackFace` down as a separate prop. */
function blobSizesToFace(blobs: readonly { size: number }[]): FallbackFace {
  if (blobs.length === 1) return blobs[0]!.size as 1 | 2 | 3;
  return [blobs[0]!.size, blobs[1]!.size] as [number, number];
}

/* Original geometric outline icons (design pass 02, Surface 07 iconography
   specimen): 24px viewBox, 1.7px stroke, square caps, currentColor, no fill.
   Path data lifted from the handoff's inline `<symbol>` defs. */
const iconAttrs = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'square' as const,
  'aria-hidden': true,
};

/** Turn — a square with a clockwise arc and arrow head. */
function TurnIcon() {
  return (
    <svg {...iconAttrs}>
      <rect x="7" y="9" width="9" height="9" />
      <path d="M6 7.5V3.5h4" />
      <path d="M6.2 3.6A9 9 0 0 1 20 8" />
    </svg>
  );
}

/** Flip — a dashed vertical axis with a mirrored bracket each side. */
function FlipIcon() {
  return (
    <svg {...iconAttrs}>
      <path d="M12 2v20" strokeDasharray="3 3" />
      <path d="M9 6H4v12h5" />
      <path d="M15 6h5v12h-5" />
    </svg>
  );
}

/** Take back — a square with an X. */
function TakeBackIcon() {
  return (
    <svg {...iconAttrs}>
      <rect x="4" y="4" width="16" height="16" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </svg>
  );
}
