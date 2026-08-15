import { cellsAt, getPiece } from '@pixwagon/game-core';
import type { FallbackFaceId, PieceId } from '@pixwagon/game-core';
import type { FallbackFace } from '../components/game/DiceFace.tsx';
import type { PieceOfferView } from '../components/game/RollControl.tsx';

/**
 * Pure view-layer conversions between game-core's wire vocabulary and the
 * design-system components' display vocabulary. Kept pure and out of any
 * component so they're testable the same way game-core itself is tested.
 */

/** A piece as offered, at its canonical (unrotated, unmirrored) orientation —
 *  rotation/mirroring is a placement-time choice (Phase 2's placement UI),
 *  not something the offer itself carries. */
export function pieceOfferView(pieceId: PieceId): PieceOfferView {
  const piece = getPiece(pieceId);
  const cells = cellsAt(piece, { rotation: 0, mirrored: false });
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
