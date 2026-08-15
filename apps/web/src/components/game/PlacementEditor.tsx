import type { PendingChoice } from '../../state/placement.ts';
import { pieceOfferView } from '../../state/offerView.ts';
import { IconButton } from '../ui/IconButton.tsx';
import { PieceGlyph } from './PieceGlyph.tsx';

export interface PlacementEditorProps {
  pending: PendingChoice;
  onSetActive: (index: number) => void;
  onRotate: () => void;
  onMirror: () => void;
  onClearActive: () => void;
}

/**
 * Composes the pending pair/fallback choice — the placement affordance
 * ROADMAP.md Phase 2 designs from `BoardCell`'s `candidate` state and the
 * disabled-not-hidden control pattern (`docs/design/surfaces/` Annotation
 * 01/04), since no annotation specifies the gesture itself. Rotate/mirror
 * only apply to the active pair piece — a fallback blob has no orientation,
 * only a cell count and (checked at commit) contiguity.
 */
export function PlacementEditor({
  pending,
  onSetActive,
  onRotate,
  onMirror,
  onClearActive,
}: PlacementEditorProps) {
  if (pending.kind === 'pair') {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Piece to place">
          {pending.pieces.map((piece, index) => (
            <button
              key={index}
              type="button"
              role="radio"
              aria-checked={pending.active === index}
              onClick={() => onSetActive(index)}
              className={[
                'flex min-h-touch flex-col items-center gap-1 rounded-lg border px-3 py-2 transition-colors duration-fast',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                pending.active === index
                  ? 'border-accent bg-accent/10'
                  : 'border-border bg-surface hover:bg-surface-sunken',
              ].join(' ')}
            >
              <PieceGlyph {...pieceOfferView(piece.pieceId, piece.orientation)} />
              <span className="text-xs text-ink-muted">
                {piece.origin
                  ? `placed at (${piece.origin.x}, ${piece.origin.y})`
                  : 'tap the board'}
              </span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <IconButton label="Rotate the selected piece" onClick={onRotate}>
            ⟳
          </IconButton>
          <IconButton label="Mirror the selected piece" onClick={onMirror}>
            ⇋
          </IconButton>
          <IconButton label="Clear the selected piece's placement" onClick={onClearActive}>
            ×
          </IconButton>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Blob to place">
        {pending.blobs.map((blob, index) => (
          <button
            key={index}
            type="button"
            role="radio"
            aria-checked={pending.active === index}
            onClick={() => onSetActive(index)}
            className={[
              'flex min-h-touch flex-col items-center gap-1 rounded-lg border px-3 py-2 transition-colors duration-fast',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              pending.active === index
                ? 'border-accent bg-accent/10'
                : 'border-border bg-surface hover:bg-surface-sunken',
            ].join(' ')}
          >
            <span className="font-mono text-sm text-ink">
              {blob.cells.length}/{blob.size}
            </span>
            <span className="text-xs text-ink-muted">blob {index + 1}</span>
          </button>
        ))}
      </div>
      <IconButton label="Clear the selected blob" onClick={onClearActive}>
        ×
      </IconButton>
    </div>
  );
}
