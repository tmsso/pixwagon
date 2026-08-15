import { cellsAt, getPiece } from '@pixwagon/game-core';
import type { FallbackFaceId, Orientation, PieceId } from '@pixwagon/game-core';
import type { FallbackFace } from '../components/game/DiceFace.tsx';
import type { PieceOfferView } from '../components/game/RollControl.tsx';

/**
 * Pure view-layer conversions between game-core's wire vocabulary and the
 * design-system components' display vocabulary. Kept pure and out of any
 * component so they're testable the same way game-core itself is tested.
 */

const CANONICAL: Orientation = { rotation: 0, mirrored: false };

/** A piece's footprint at a given orientation, as `PieceGlyph` wants it —
 *  defaults to the canonical (unrotated, unmirrored) orientation for the
 *  round-offer display; the placement editor passes the pending piece's
 *  current orientation while the player is composing a move. */
export function pieceOfferView(
  pieceId: PieceId,
  orientation: Orientation = CANONICAL,
): PieceOfferView {
  const piece = getPiece(pieceId);
  const cells = cellsAt(piece, orientation);
  return { id: pieceId, cells: cells.map((cell) => ({ x: cell.dx, y: cell.dy })) };
}

/** `DiceFace`'s `FallbackFace` is a display shape (a bare number or a 2-tuple);
 *  `FallbackFaceId` is the wire id. `FALLBACK_BLOB_SIZES` is the single source
 *  for what each id means; `DiceFace.tsx`'s `1 | 2 | 3` literal union (not a
 *  general `number`) is why this switches on the id rather than reading the
 *  blob sizes straight off the array. */
export function fallbackFaceView(id: FallbackFaceId): FallbackFace {
  switch (id) {
    case '1':
      return 1;
    case '2':
      return 2;
    case '3':
      return 3;
    case '1+2':
      return [1, 2];
    case '2+2':
      return [2, 2];
    case '1+3':
      return [1, 3];
  }
}
