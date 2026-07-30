import { NotImplementedError } from './not-implemented.js';
import type { Board, Move, MoveResult, Roll } from './types.js';

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

/** Phase 1: cheap pre-check for UI affordances (which cells to highlight). */
export function legalCellsFor(_board: Board, _roll: Roll, _comboId: string): Board['cells'] {
  throw new NotImplementedError('legalCellsFor');
}
