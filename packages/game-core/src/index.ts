/**
 * @pixwagon/game-core — the rules, as a pure module.
 *
 * Hard rule: nothing in this package may import from `apps/`, touch the network,
 * read the filesystem, or reference `window`/`WebSocket`/Cloudflare globals. It
 * runs unchanged in a browser tab and inside a Durable Object; the moment it
 * stops doing that, the client and the server can disagree about the rules.
 */

export * from './types.js';
export { NotImplementedError } from './not-implemented.js';
export { createRng, deriveSeed, type Rng } from './rng.js';
export {
  ALL_ORIENTATIONS,
  cellKey,
  cellsAt,
  distinctOrientationsOf,
  getPiece,
  normalize,
  SHAPE_LIBRARY,
  type CellOffset,
  type Orientation,
  type Piece,
  type PieceId,
  type Rotation,
} from './shapes.js';
export { areContiguous, cellAt, cellIndex, createBoard, inBounds, isComplete } from './board.js';
export { issueRoll } from './roll.js';
export { applyMove, legalCellsFor, type PieceOrigin } from './moves.js';
export { scoreBoard, scoreRound } from './scoring.js';
