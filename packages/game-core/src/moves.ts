import { cellAt, inBounds, areContiguous } from './board.js';
import { cellsAt, distinctOrientationsOf, getPiece, isKnownPiece } from './shapes.js';
import type { CellOffset, Orientation, PieceId } from './shapes.js';
import type {
  Board,
  CellRef,
  CellState,
  FallbackFaceId,
  Move,
  MoveResult,
  MoveRejection,
  PiecePlacement,
  Roll,
} from './types.js';
import { FALLBACK_BLOB_SIZES } from './types.js';

function reject(reason: MoveRejection): MoveResult {
  return { ok: false, reason };
}

function absoluteCells(placement: PiecePlacement): readonly CellRef[] {
  const piece = getPiece(placement.pieceId);
  return cellsAt(piece, placement.orientation).map((offset: CellOffset) => ({
    x: placement.origin.x + offset.dx,
    y: placement.origin.y + offset.dy,
  }));
}

/** Every cell in `cells` is in bounds and currently `fillable` — the shared per-cell check. */
function checkCellsFillable(board: Board, cells: readonly CellRef[]): MoveRejection | null {
  for (const cell of cells) {
    if (!inBounds(board.size, cell)) return 'out-of-bounds';
    const state: CellState | undefined = cellAt(board, cell);
    if (state === 'blank') return 'cell-not-fillable';
    if (state === 'filled' || state === 'locked') return 'cell-already-filled';
  }
  return null;
}

function cellKey(cell: CellRef): string {
  return `${cell.x},${cell.y}`;
}

function hasOverlap(groups: readonly (readonly CellRef[])[]): boolean {
  const seen = new Set<string>();
  for (const group of groups) {
    for (const cell of group) {
      const key = cellKey(cell);
      if (seen.has(key)) return true;
      seen.add(key);
    }
  }
  return false;
}

function withFilled(board: Board, cells: readonly CellRef[]): Board {
  const next = board.cells.slice();
  for (const cell of cells) {
    // Every cell here already passed checkCellsFillable, so it's in bounds.
    const index = cell.y * board.size.width + cell.x;
    next[index] = 'filled';
  }
  return { ...board, cells: next };
}

function applyPairMove(
  board: Board,
  roll: Roll,
  placements: readonly [PiecePlacement, PiecePlacement],
): MoveResult {
  for (const placement of placements) {
    if (!isKnownPiece(placement.pieceId)) return reject('unknown-piece');
  }

  // Bijective match against the roll's pair, not just "each id is somewhere in
  // it": roll.pair is always 2 *distinct* ids, so a plain Set.has() check on
  // each placement would wrongly accept two placements both claiming the same
  // offered piece (using it twice when the roll only offers one of it).
  const placementIds = placements.map((placement) => placement.pieceId).sort();
  const offeredIds = [...roll.pair].sort();
  if (placementIds[0] !== offeredIds[0] || placementIds[1] !== offeredIds[1]) {
    return reject('not-offered');
  }

  const groups = placements.map((placement) => absoluteCells(placement));
  if (hasOverlap(groups)) return reject('overlapping-placement');

  for (const cells of groups) {
    const rejection = checkCellsFillable(board, cells);
    if (rejection) return reject(rejection);
  }

  return { ok: true, board: withFilled(board, groups.flat()) };
}

function applyFallbackMove(
  board: Board,
  fallback: FallbackFaceId,
  blobs: readonly (readonly CellRef[])[],
): MoveResult {
  const requiredSizes = [...FALLBACK_BLOB_SIZES[fallback]].sort((a, b) => a - b);

  // Wrong *count* of blobs (e.g. 1 blob for a compound 2-blob face) is the
  // both-or-nothing rule from docs/mechanics-correction.md; wrong *size* with
  // the right count is a separate, more specific rejection.
  if (blobs.length !== requiredSizes.length) return reject('incomplete-compound-choice');

  const actualSizes = blobs.map((blob) => blob.length).sort((a, b) => a - b);
  if (actualSizes.some((size, i) => size !== requiredSizes[i])) {
    return reject('blob-size-mismatch');
  }

  for (const blob of blobs) {
    if (!areContiguous(board.size, blob)) return reject('blob-not-contiguous');
  }

  if (hasOverlap(blobs)) return reject('overlapping-placement');

  for (const blob of blobs) {
    const rejection = checkCellsFillable(board, blob);
    if (rejection) return reject(rejection);
  }

  return { ok: true, board: withFilled(board, blobs.flat()) };
}

/**
 * The referee's core question — given a board, the roll in force, and a
 * proposed fill, is it legal?
 *
 * This is the single function that both sides run (§4A). The client calls it to
 * decide whether to show an optimistic fill; the Durable Object calls it to
 * decide the truth. Any divergence between those two answers is a bug in this
 * file, which is why Phase 1 tests it exhaustively before anything is wired up.
 */
export function applyMove(board: Board, roll: Roll, move: Move): MoveResult {
  if (move.round !== roll.round) return reject('wrong-round');

  if (move.choice.kind === 'pair') {
    return applyPairMove(board, roll, move.choice.placements);
  }

  return applyFallbackMove(board, roll.fallback, move.choice.blobs);
}

/** A placement `legalCellsFor` found: this piece fits here, in this orientation. */
export interface PieceOrigin {
  orientation: Orientation;
  origin: CellRef;
}

/**
 * Cheap pre-check for UI affordances — every orientation/origin pair at which
 * `pieceId` currently fits this board, so the client can highlight legal
 * placements without asking the server. Board-only: a piece's fit doesn't
 * depend on the round in force (see docs/mechanics-correction.md —
 * `legalCellsFor`'s old `Board['cells']` return type couldn't express "valid
 * origins across up to 8 orientations", hence the new return shape).
 */
export function legalCellsFor(board: Board, pieceId: PieceId): readonly PieceOrigin[] {
  const piece = getPiece(pieceId);
  const results: PieceOrigin[] = [];

  for (const orientation of distinctOrientationsOf(piece)) {
    const offsets = cellsAt(piece, orientation);
    for (let y = 0; y < board.size.height; y += 1) {
      for (let x = 0; x < board.size.width; x += 1) {
        const origin = { x, y };
        const cells = offsets.map((offset) => ({ x: x + offset.dx, y: y + offset.dy }));
        if (checkCellsFillable(board, cells) === null) {
          results.push({ orientation, origin });
        }
      }
    }
  }

  return results;
}
