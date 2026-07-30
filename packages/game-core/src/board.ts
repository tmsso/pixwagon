import { NotImplementedError } from './not-implemented.js';
import type { Board, CellRef, CellState, GridSize } from './types.js';

/** Row-major index. Kept real because every other board function needs it. */
export function cellIndex(size: GridSize, cell: CellRef): number {
  return cell.y * size.width + cell.x;
}

export function inBounds(size: GridSize, cell: CellRef): boolean {
  return (
    Number.isInteger(cell.x) &&
    Number.isInteger(cell.y) &&
    cell.x >= 0 &&
    cell.y >= 0 &&
    cell.x < size.width &&
    cell.y < size.height
  );
}

export function cellAt(board: Board, cell: CellRef): CellState | undefined {
  if (!inBounds(board.size, cell)) return undefined;
  return board.cells[cellIndex(board.size, cell)];
}

/** Phase 1: build a fresh board from a pack picture. */
export function createBoard(_packId: string, _pictureId: string): Board {
  throw new NotImplementedError('createBoard');
}

/** Phase 1: has every fillable cell been filled? */
export function isComplete(_board: Board): boolean {
  throw new NotImplementedError('isComplete');
}

/** Phase 1: orthogonal-adjacency check for multi-cell combo placements. */
export function areContiguous(_size: GridSize, _cells: readonly CellRef[]): boolean {
  throw new NotImplementedError('areContiguous');
}
