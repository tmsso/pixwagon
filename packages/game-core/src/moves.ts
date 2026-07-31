import { NotImplementedError } from './not-implemented.js';
import type { Orientation, PieceId } from './shapes.js';
import type { Board, CellRef, Move, MoveResult, Roll } from './types.js';

/**
 * Phase 1: the referee's core question — given a board, the roll in force, and a
 * proposed fill, is it legal?
 *
 * This is the single function that both sides run (§4A). The client calls it to
 * decide whether to show an optimistic fill; the Durable Object calls it to
 * decide the truth. Any divergence between those two answers is a bug in this
 * file, which is why Phase 1 tests it exhaustively before anything is wired up.
 */
export function applyMove(_board: Board, _roll: Roll, _move: Move): MoveResult {
  throw new NotImplementedError('applyMove');
}

/** A placement `legalCellsFor` found: this piece fits here, in this orientation. */
export interface PieceOrigin {
  orientation: Orientation;
  origin: CellRef;
}

/**
 * Phase 1: cheap pre-check for UI affordances — every orientation/origin pair
 * at which `pieceId` currently fits this board, so the client can highlight
 * legal placements without asking the server. Board-only: a piece's fit
 * doesn't depend on the round in force (see docs/mechanics-correction.md —
 * `legalCellsFor`'s old `Board['cells']` return type couldn't express "valid
 * origins across up to 8 orientations", hence the new return shape).
 */
export function legalCellsFor(_board: Board, _pieceId: PieceId): readonly PieceOrigin[] {
  throw new NotImplementedError('legalCellsFor');
}
