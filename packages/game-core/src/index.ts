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
export { areContiguous, cellAt, cellIndex, createBoard, inBounds, isComplete } from './board.js';
export { comboOptionsFor, issueRoll } from './roll.js';
export { applyMove, legalCellsFor } from './moves.js';
export { scoreBoard, scoreRound } from './scoring.js';
