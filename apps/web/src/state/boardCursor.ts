import type { Board, CellRef } from '@pixwagon/game-core';

/**
 * Keyboard navigation for the board (ROADMAP.md Phase 9, "keyboard navigation
 * across all surfaces"). The board is a canvas, so there are no DOM cells to
 * tab between: it is one focusable element with a roving cursor the arrow keys
 * move, and Enter/Space presses the cursor's cell exactly as a tap would. Kept
 * pure so the rules are tested without a browser.
 */

const STEP: Readonly<Record<string, CellRef>> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

/** Where the cursor lands when the board first takes focus: the first square
 *  of the picture in reading order, so a keyboard player starts on something
 *  they can use rather than in the blank margin. */
export function initialCursor(board: Board): CellRef {
  const { width } = board.size;
  const first = board.cells.findIndex((cell) => cell !== 'blank');
  const index = first === -1 ? 0 : first;
  return { x: index % width, y: Math.floor(index / width) };
}

/** The cursor after `key`, clamped to the board — or `null` for a key that
 *  doesn't move it. Arrow keys step by one; Home and End jump to the row's ends. */
export function moveCursor(cursor: CellRef, key: string, board: Board): CellRef | null {
  const { width, height } = board.size;
  const clamp = (value: number, max: number) => Math.min(max - 1, Math.max(0, value));
  if (key === 'Home') return { x: 0, y: cursor.y };
  if (key === 'End') return { x: width - 1, y: cursor.y };
  const step = STEP[key];
  if (!step) return null;
  return { x: clamp(cursor.x + step.x, width), y: clamp(cursor.y + step.y, height) };
}

/** What a screen reader says as the cursor moves: where it is, and what that
 *  square is. 1-based, the way people count rows and columns. */
export function describeCell(board: Board, cell: CellRef): string {
  const state = board.cells[cell.y * board.size.width + cell.x];
  const what =
    state === 'fillable'
      ? 'empty, to fill'
      : state === 'filled'
        ? 'filled'
        : state === 'locked'
          ? 'locked'
          : 'outside the picture';
  return `Column ${cell.x + 1}, row ${cell.y + 1}, ${what}`;
}
