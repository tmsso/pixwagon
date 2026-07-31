import type { ReactNode } from 'react';
import { DiceFace, type FallbackFace } from './DiceFace.tsx';
import { PieceGlyph } from './PieceGlyph.tsx';

export interface PieceOfferView {
  id: string;
  cells: readonly { x: number; y: number }[];
}

export type OfferChoice = 'pair' | 'fallback';

export interface RollControlProps {
  /** The round's offered pair — placed together or declined, never partially. */
  pair: readonly [PieceOfferView, PieceOfferView];
  /** The round's independent fallback-die value. Revealed up front, not gated
   *  behind declining the pair — see docs/mechanics-correction.md for why:
   *  a decline-to-reveal design would leak the value to slower-deciding
   *  players in same-board mode. */
  fallbackFace: FallbackFace;
  selectedChoice?: OfferChoice;
  /** True between submitting a fill and the referee's answer. */
  awaitingServer?: boolean;
  onChoose?: (choice: OfferChoice) => void;
}

/**
 * The round-offer control (docs/mechanics-correction.md): a polyomino pair and
 * an independent fallback die, both already known — the player picks one,
 * freely, every round. This replaces the old single "Roll" + combo-list
 * control from the dice/combo model.
 *
 * `awaitingServer` is the state that matters most and the one easiest to
 * forget: clients submit intent and the server decides, so there is a real
 * window where the player must not be able to submit again. It disables the
 * controls rather than hiding them, so the layout does not jump.
 */
export function RollControl({
  pair,
  fallbackFace,
  selectedChoice,
  awaitingServer = false,
  onChoose,
}: RollControlProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Round offer">
        <OfferCard
          label="Pair"
          selected={selectedChoice === 'pair'}
          disabled={awaitingServer}
          onSelect={() => onChoose?.('pair')}
        >
          <div className="flex gap-2">
            {pair.map((piece) => (
              <PieceGlyph key={piece.id} cells={piece.cells} />
            ))}
          </div>
        </OfferCard>

        <OfferCard
          label="Fallback"
          selected={selectedChoice === 'fallback'}
          disabled={awaitingServer}
          onSelect={() => onChoose?.('fallback')}
        >
          <DiceFace face={fallbackFace} />
        </OfferCard>
      </div>

      {awaitingServer ? (
        <p className="text-sm text-ink-muted" role="status">
          Waiting for the referee…
        </p>
      ) : null}
    </div>
  );
}

function OfferCard({
  label,
  selected,
  disabled,
  onSelect,
  children,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={[
        'flex min-h-touch flex-col items-center gap-2 rounded-lg border px-4 py-3 transition-colors duration-fast',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        selected
          ? 'border-accent bg-accent/10'
          : 'border-border bg-surface hover:bg-surface-sunken',
      ].join(' ')}
    >
      <span className="font-mono text-xs uppercase tracking-wide text-ink-muted">{label}</span>
      {children}
    </button>
  );
}
