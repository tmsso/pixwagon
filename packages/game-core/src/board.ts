import { getPack } from '@pixwagon/packs';
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

/**
 * Builds a fresh board from a pack picture. `@pixwagon/packs` is a pure
 * sibling package (schema + data, no network/filesystem at read time — the
 * shipped packs are parsed once at module load) so depending on it here
 * doesn't compromise game-core's own purity (§4A); the client and the
 * Durable Object both already depend on it directly for rendering/validation.
 */
export function createBoard(packId: string, pictureId: string): Board {
  const pack = getPack(packId);
  if (!pack) throw new Error(`unknown pack "${packId}"`);

  const picture = pack.pictures.find((candidate) => candidate.id === pictureId);
  if (!picture) throw new Error(`unknown picture "${pictureId}" in pack "${packId}"`);

  const width = picture.rows[0]?.length ?? 0;
  const height = picture.rows.length;
  const cells: CellState[] = [];
  for (const row of picture.rows) {
    for (const char of row) {
      cells.push(char === '.' ? 'blank' : 'fillable');
    }
  }

  return { size: { width, height }, packId, pictureId, cells };
}

/** Has every fillable cell been filled (or locked, which is also resolved)? */
export function isComplete(board: Board): boolean {
  return board.cells.every((cell) => cell !== 'fillable');
}

/** Orthogonal-adjacency check for multi-cell placements (pair pieces, fallback blobs). */
export function areContiguous(_size: GridSize, cells: readonly CellRef[]): boolean {
  if (cells.length <= 1) return true;

  // A string key, not the row-major index: cells here aren't guaranteed in-bounds
  // yet (callers check that separately), and negative coordinates could otherwise
  // collide with an unrelated in-bounds cell under `cellIndex`'s arithmetic.
  const key = (cell: CellRef): string => `${cell.x},${cell.y}`;
  const remaining = new Set(cells.map(key));
  const start = cells[0]!;
  const stack: CellRef[] = [start];
  const visited = new Set<string>([key(start)]);

  while (stack.length > 0) {
    const { x, y } = stack.pop()!;
    const neighbors: CellRef[] = [
      { x: x + 1, y },
      { x: x - 1, y },
      { x, y: y + 1 },
      { x, y: y - 1 },
    ];
    for (const neighbor of neighbors) {
      const neighborKey = key(neighbor);
      if (!remaining.has(neighborKey) || visited.has(neighborKey)) continue;
      visited.add(neighborKey);
      stack.push(neighbor);
    }
  }

  return visited.size === remaining.size;
}
