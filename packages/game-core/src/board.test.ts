import { describe, expect, it } from 'vitest';
import { areContiguous, cellAt, cellIndex, createBoard, inBounds, isComplete } from './board.js';
import type { Board, CellState } from './types.js';

describe('createBoard', () => {
  it('builds a board matching the transportation pack tram picture', () => {
    const board = createBoard('transportation', 'tram');
    expect(board).toEqual({
      packId: 'transportation',
      pictureId: 'tram',
      size: { width: 12, height: 8 },
      cells: expect.any(Array) as unknown as readonly CellState[],
    });
    expect(board.cells).toHaveLength(12 * 8);
    expect(board.cells.some((cell) => cell === 'fillable')).toBe(true);
    expect(board.cells.every((cell) => cell === 'blank' || cell === 'fillable')).toBe(true);
  });

  it('throws a readable error for an unknown pack', () => {
    expect(() => createBoard('not-a-pack', 'tram')).toThrow(/unknown pack/);
  });

  it('throws a readable error for an unknown picture in a real pack', () => {
    expect(() => createBoard('transportation', 'not-a-picture')).toThrow(/unknown picture/);
  });
});

describe('isComplete', () => {
  const size = { width: 2, height: 2 };

  it('is false while any cell is still fillable', () => {
    const board: Board = {
      size,
      packId: 'p',
      pictureId: 'x',
      cells: ['fillable', 'filled', 'blank', 'filled'],
    };
    expect(isComplete(board)).toBe(false);
  });

  it('is true once every non-blank cell is filled or locked', () => {
    const board: Board = {
      size,
      packId: 'p',
      pictureId: 'x',
      cells: ['filled', 'locked', 'blank', 'filled'],
    };
    expect(isComplete(board)).toBe(true);
  });

  it('is true for an all-blank board (nothing to fill)', () => {
    const board: Board = {
      size,
      packId: 'p',
      pictureId: 'x',
      cells: ['blank', 'blank', 'blank', 'blank'],
    };
    expect(isComplete(board)).toBe(true);
  });
});

describe('areContiguous', () => {
  const size = { width: 10, height: 10 };

  it('is true for a single cell', () => {
    expect(areContiguous(size, [{ x: 3, y: 3 }])).toBe(true);
  });

  it('is true for an orthogonally connected L-shape', () => {
    expect(
      areContiguous(size, [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ]),
    ).toBe(true);
  });

  it('is false for two separated cells', () => {
    expect(
      areContiguous(size, [
        { x: 0, y: 0 },
        { x: 5, y: 5 },
      ]),
    ).toBe(false);
  });

  it('is false for diagonally-touching-only cells (no orthogonal path)', () => {
    expect(
      areContiguous(size, [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ]),
    ).toBe(false);
  });

  it('is true regardless of input order', () => {
    const cells = [
      { x: 2, y: 2 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ];
    expect(areContiguous(size, cells)).toBe(true);
  });
});

describe('cellIndex / inBounds / cellAt', () => {
  const board: Board = {
    size: { width: 3, height: 2 },
    packId: 'p',
    pictureId: 'x',
    cells: ['blank', 'fillable', 'filled', 'fillable', 'blank', 'locked'],
  };

  it('indexes row-major', () => {
    expect(cellIndex(board.size, { x: 0, y: 1 })).toBe(3);
  });

  it('rejects out-of-bounds and non-integer coordinates', () => {
    expect(inBounds(board.size, { x: 3, y: 0 })).toBe(false);
    expect(inBounds(board.size, { x: -1, y: 0 })).toBe(false);
    expect(inBounds(board.size, { x: 1.5, y: 0 })).toBe(false);
  });

  it('reads the cell state at a ref, undefined out of bounds', () => {
    expect(cellAt(board, { x: 2, y: 0 })).toBe('filled');
    expect(cellAt(board, { x: 5, y: 5 })).toBeUndefined();
  });
});
