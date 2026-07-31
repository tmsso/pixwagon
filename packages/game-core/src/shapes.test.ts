import { describe, expect, it } from 'vitest';
import {
  ALL_ORIENTATIONS,
  cellKey,
  cellsAt,
  distinctOrientationsOf,
  normalize,
  SHAPE_LIBRARY,
  getPiece,
} from './shapes.js';

describe('SHAPE_LIBRARY', () => {
  it('has exactly the 9 free polyominoes of size 1-4', () => {
    expect(SHAPE_LIBRARY.map((piece) => piece.cells.length)).toEqual([1, 2, 3, 3, 4, 4, 4, 4, 4]);
  });

  it('every piece is already normalized (starts at (0, 0), sorted)', () => {
    for (const piece of SHAPE_LIBRARY) {
      expect(piece.cells).toEqual(normalize(piece.cells));
    }
  });

  /**
   * Locks order and contents. Reordering, inserting, or reshaping an entry
   * silently changes every seeded room and every past daily puzzle — see the
   * module docstring in shapes.ts and docs/contracts/rng.md's shape-library
   * snapshot-discipline section. Changing this snapshot must be a deliberate,
   * versioned act, not an incidental refactor.
   */
  it('matches the frozen reference library', () => {
    expect(SHAPE_LIBRARY).toMatchInlineSnapshot(`
      [
        {
          "cells": [
            {
              "dx": 0,
              "dy": 0,
            },
          ],
          "id": "monomino",
        },
        {
          "cells": [
            {
              "dx": 0,
              "dy": 0,
            },
            {
              "dx": 1,
              "dy": 0,
            },
          ],
          "id": "domino",
        },
        {
          "cells": [
            {
              "dx": 0,
              "dy": 0,
            },
            {
              "dx": 1,
              "dy": 0,
            },
            {
              "dx": 2,
              "dy": 0,
            },
          ],
          "id": "tromino-i",
        },
        {
          "cells": [
            {
              "dx": 0,
              "dy": 0,
            },
            {
              "dx": 1,
              "dy": 0,
            },
            {
              "dx": 0,
              "dy": 1,
            },
          ],
          "id": "tromino-l",
        },
        {
          "cells": [
            {
              "dx": 0,
              "dy": 0,
            },
            {
              "dx": 1,
              "dy": 0,
            },
            {
              "dx": 2,
              "dy": 0,
            },
            {
              "dx": 3,
              "dy": 0,
            },
          ],
          "id": "tetromino-i",
        },
        {
          "cells": [
            {
              "dx": 0,
              "dy": 0,
            },
            {
              "dx": 1,
              "dy": 0,
            },
            {
              "dx": 0,
              "dy": 1,
            },
            {
              "dx": 1,
              "dy": 1,
            },
          ],
          "id": "tetromino-o",
        },
        {
          "cells": [
            {
              "dx": 0,
              "dy": 0,
            },
            {
              "dx": 1,
              "dy": 0,
            },
            {
              "dx": 2,
              "dy": 0,
            },
            {
              "dx": 1,
              "dy": 1,
            },
          ],
          "id": "tetromino-t",
        },
        {
          "cells": [
            {
              "dx": 1,
              "dy": 0,
            },
            {
              "dx": 2,
              "dy": 0,
            },
            {
              "dx": 0,
              "dy": 1,
            },
            {
              "dx": 1,
              "dy": 1,
            },
          ],
          "id": "tetromino-s",
        },
        {
          "cells": [
            {
              "dx": 0,
              "dy": 0,
            },
            {
              "dx": 0,
              "dy": 1,
            },
            {
              "dx": 0,
              "dy": 2,
            },
            {
              "dx": 1,
              "dy": 2,
            },
          ],
          "id": "tetromino-l",
        },
      ]
    `);
  });

  it('getPiece looks up every id in the library', () => {
    for (const piece of SHAPE_LIBRARY) {
      expect(getPiece(piece.id)).toBe(piece);
    }
  });
});

describe('cellsAt / orientation', () => {
  it('rotating 4 times returns to the original footprint', () => {
    for (const piece of SHAPE_LIBRARY) {
      let cells = piece.cells;
      for (let i = 0; i < 4; i += 1) {
        cells = cellsAt({ id: piece.id, cells }, { rotation: 90, mirrored: false });
      }
      expect(cellKey(cells)).toBe(cellKey(piece.cells));
    }
  });

  it('mirroring twice returns to the original footprint', () => {
    for (const piece of SHAPE_LIBRARY) {
      const once = cellsAt(piece, { rotation: 0, mirrored: true });
      const twice = cellsAt({ id: piece.id, cells: once }, { rotation: 0, mirrored: true });
      expect(cellKey(twice)).toBe(cellKey(piece.cells));
    }
  });

  it('every orientation stays the same cell count as the canonical piece', () => {
    for (const piece of SHAPE_LIBRARY) {
      for (const orientation of ALL_ORIENTATIONS) {
        expect(cellsAt(piece, orientation)).toHaveLength(piece.cells.length);
      }
    }
  });

  it('the O-tetromino (fully symmetric) collapses to a single distinct orientation', () => {
    const square = getPiece('tetromino-o');
    expect(distinctOrientationsOf(square)).toHaveLength(1);
  });

  it('the I-tetromino (2-fold symmetric) collapses to 2 distinct orientations', () => {
    const line = getPiece('tetromino-i');
    expect(distinctOrientationsOf(line)).toHaveLength(2);
  });

  it('the monomino collapses to a single distinct orientation', () => {
    expect(distinctOrientationsOf(getPiece('monomino'))).toHaveLength(1);
  });

  it('the S-tetromino (180°-symmetric) has 4 distinct orientations', () => {
    const s = getPiece('tetromino-s');
    expect(distinctOrientationsOf(s)).toHaveLength(4);
  });

  it('the L-tromino (diagonal mirror symmetry) has 4 distinct orientations', () => {
    const l = getPiece('tromino-l');
    expect(distinctOrientationsOf(l)).toHaveLength(4);
  });

  it('the L-tetromino (fully asymmetric — L and J are both reachable) has all 8 orientations distinct', () => {
    const l = getPiece('tetromino-l');
    expect(distinctOrientationsOf(l)).toHaveLength(8);
  });
});
