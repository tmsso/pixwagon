import { cellsAt, getPiece, legalCellsFor } from '@pixwagon/game-core';
import { FALLBACK_BLOB_SIZES } from '@pixwagon/game-core';
import type { Board, CellRef, FallbackFaceId, Orientation, PieceId } from '@pixwagon/game-core';

/**
 * Client-side placement legality helpers — used to drive UI affordances
 * (which cells to enable, whether "commit" can be pressed, whether the round
 * is genuinely stuck). Solo has no referee to ask, so this is the closest
 * thing to one; `applyMove` (game-core) is still the actual authority at
 * commit time, exactly the way a networked client's optimistic prediction
 * works in Phase 5 — the difference here is there's no server to overturn it.
 */

export function absolutePieceCells(
  pieceId: PieceId,
  orientation: Orientation,
  origin: CellRef,
): CellRef[] {
  const piece = getPiece(pieceId);
  return cellsAt(piece, orientation).map((offset) => ({
    x: origin.x + offset.dx,
    y: origin.y + offset.dy,
  }));
}

function cellKey(cell: CellRef): string {
  return `${cell.x},${cell.y}`;
}

/** Does *some* non-overlapping arrangement of both pair pieces exist on this board? */
export function pairHasLegalPlacement(board: Board, pair: readonly [PieceId, PieceId]): boolean {
  const optionsA = legalCellsFor(board, pair[0]);
  const optionsB = legalCellsFor(board, pair[1]);

  for (const a of optionsA) {
    const cellsA = new Set(absolutePieceCells(pair[0], a.orientation, a.origin).map(cellKey));
    for (const b of optionsB) {
      const cellsB = absolutePieceCells(pair[1], b.orientation, b.origin);
      if (cellsB.every((cell) => !cellsA.has(cellKey(cell)))) return true;
    }
  }
  return false;
}

const NEIGHBOR_OFFSETS: readonly CellRef[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

function fillableCellSet(board: Board): Set<string> {
  const cells = new Set<string>();
  for (let y = 0; y < board.size.height; y += 1) {
    for (let x = 0; x < board.size.width; x += 1) {
      if (board.cells[y * board.size.width + x] === 'fillable') cells.add(cellKey({ x, y }));
    }
  }
  return cells;
}

/** Every distinct orthogonally-connected cell-set of exactly `size` cells
 *  within `available`. A brute-force grow-by-one-cell enumeration — fine at
 *  the sizes and board sizes this ever runs against (fallback blobs cap at
 *  3, ROADMAP.md Phase 1; picture boards are tens to low hundreds of cells),
 *  and it means `fallbackHasLegalPlacement` below can be exact instead of a
 *  conservative approximation. An early false positive here found by a live
 *  playthrough (a board fragmented into two regions, each big enough for one
 *  required blob size on its own but not both at once) is exactly the case a
 *  component-size-only check gets wrong — worth keeping exact rather than
 *  reintroducing that gap. */
function enumerateBlobs(available: ReadonlySet<string>, size: number): CellRef[][] {
  const toCell = (key: string): CellRef => {
    const [x, y] = key.split(',').map(Number);
    return { x: x!, y: y! };
  };

  let candidates: CellRef[][] = [...available].map((key) => [toCell(key)]);
  for (let grown = 1; grown < size; grown += 1) {
    const next: CellRef[][] = [];
    const seen = new Set<string>();
    for (const blob of candidates) {
      for (const cell of blob) {
        for (const offset of NEIGHBOR_OFFSETS) {
          const neighbor = { x: cell.x + offset.x, y: cell.y + offset.y };
          const neighborKey = cellKey(neighbor);
          if (!available.has(neighborKey)) continue;
          if (blob.some((c) => c.x === neighbor.x && c.y === neighbor.y)) continue;
          const signature = [...blob, neighbor].map(cellKey).sort().join('|');
          if (seen.has(signature)) continue;
          seen.add(signature);
          next.push([...blob, neighbor]);
        }
      }
    }
    candidates = next;
  }
  return candidates;
}

/** Exact: can every required blob size be placed simultaneously, each
 *  disjoint from the others and from already-filled cells? Tries the larger
 *  size first — fewer, more constraining candidates to branch on. */
export function fallbackHasLegalPlacement(board: Board, face: FallbackFaceId): boolean {
  const sizes = [...FALLBACK_BLOB_SIZES[face]].sort((a, b) => b - a);

  function search(available: ReadonlySet<string>, remaining: readonly number[]): boolean {
    if (remaining.length === 0) return true;
    const [size, ...rest] = remaining;
    for (const blob of enumerateBlobs(available, size!)) {
      const next = new Set(available);
      for (const cell of blob) next.delete(cellKey(cell));
      if (search(next, rest)) return true;
    }
    return false;
  }

  return search(fillableCellSet(board), sizes);
}
