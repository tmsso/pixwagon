import { describe, expect, it } from 'vitest';
import { createBoard, fillCells } from '@pixwagon/game-core';
import { describeCell, initialCursor, moveCursor } from './boardCursor.ts';

const board = createBoard('transportation', 'tram');
const { width, height } = board.size;

describe('board cursor', () => {
  it('starts on the first square of the picture, not the blank margin', () => {
    const start = initialCursor(board);
    expect(board.cells[start.y * width + start.x]).not.toBe('blank');
    // Nothing earlier in reading order is part of the picture.
    expect(board.cells.slice(0, start.y * width + start.x).every((c) => c === 'blank')).toBe(true);
  });

  it('moves one square with the arrows and stops at the edges', () => {
    expect(moveCursor({ x: 3, y: 3 }, 'ArrowRight', board)).toEqual({ x: 4, y: 3 });
    expect(moveCursor({ x: 3, y: 3 }, 'ArrowUp', board)).toEqual({ x: 3, y: 2 });
    expect(moveCursor({ x: 0, y: 0 }, 'ArrowLeft', board)).toEqual({ x: 0, y: 0 });
    expect(moveCursor({ x: 0, y: 0 }, 'ArrowUp', board)).toEqual({ x: 0, y: 0 });
    expect(moveCursor({ x: width - 1, y: height - 1 }, 'ArrowRight', board)).toEqual({
      x: width - 1,
      y: height - 1,
    });
    expect(moveCursor({ x: 2, y: height - 1 }, 'ArrowDown', board)).toEqual({
      x: 2,
      y: height - 1,
    });
  });

  it('jumps to the ends of the row with Home and End, and ignores other keys', () => {
    expect(moveCursor({ x: 5, y: 2 }, 'Home', board)).toEqual({ x: 0, y: 2 });
    expect(moveCursor({ x: 5, y: 2 }, 'End', board)).toEqual({ x: width - 1, y: 2 });
    expect(moveCursor({ x: 5, y: 2 }, 'a', board)).toBeNull();
  });

  it('describes a square in words, counting from 1', () => {
    const start = initialCursor(board);
    expect(describeCell(board, start)).toBe(
      `Column ${start.x + 1}, row ${start.y + 1}, empty, to fill`,
    );
    expect(describeCell(fillCells(board, [start]), start)).toMatch(/filled$/);
    expect(describeCell(board, { x: 0, y: 0 })).toMatch(/outside the picture$/);
  });
});
