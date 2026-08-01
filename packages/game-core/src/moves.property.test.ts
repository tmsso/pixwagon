import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { applyMove } from './moves.js';
import type { Board, CellRef, CellState, FallbackFaceId, Move, Roll } from './types.js';

/**
 * Grows a random-but-always-orthogonally-contiguous blob of exactly `size`
 * cells on a `width` x `height` fully-open board, starting from the centre
 * (always far enough from every edge for the blob sizes this file uses: 1-3
 * cells on an 8x8 board). `picks` drives which frontier cell gets added at
 * each step — fast-check supplies it, so the same seed always regrows the
 * same blob, which is what makes a failing case shrinkable/reproducible.
 */
function growBlob(
  width: number,
  height: number,
  size: number,
  picks: readonly number[],
): CellRef[] {
  const start: CellRef = { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  const included: CellRef[] = [start];
  const includedKeys = new Set([`${start.x},${start.y}`]);
  let pickIndex = 0;

  while (included.length < size) {
    const frontier = new Map<string, CellRef>();
    for (const cell of included) {
      const neighbors: CellRef[] = [
        { x: cell.x + 1, y: cell.y },
        { x: cell.x - 1, y: cell.y },
        { x: cell.x, y: cell.y + 1 },
        { x: cell.x, y: cell.y - 1 },
      ];
      for (const neighbor of neighbors) {
        if (neighbor.x < 0 || neighbor.y < 0 || neighbor.x >= width || neighbor.y >= height)
          continue;
        const key = `${neighbor.x},${neighbor.y}`;
        if (includedKeys.has(key)) continue;
        frontier.set(key, neighbor);
      }
    }
    const options = [...frontier.values()];
    const pick = options[picks[pickIndex % picks.length]! % options.length]!;
    included.push(pick);
    includedKeys.add(`${pick.x},${pick.y}`);
    pickIndex += 1;
  }

  return included;
}

function openBoard(width: number, height: number): Board {
  const cells: CellState[] = Array.from({ length: width * height }, () => 'fillable');
  return { size: { width, height }, packId: 'test', pictureId: 'test', cells };
}

function rollWithFallback(fallback: FallbackFaceId): Roll {
  return { round: 0, seed: 'property-test', pair: ['domino', 'tromino-i'], fallback };
}

const picksArbitrary = fc.array(fc.nat({ max: 20 }), { minLength: 12, maxLength: 12 });

describe('applyMove — property: a legal fallback move is never rejected', () => {
  it('any contiguous blob of the right size, on an open board, is accepted', () => {
    fc.assert(
      fc.property(fc.constantFrom<FallbackFaceId>('1', '2', '3'), picksArbitrary, (face, picks) => {
        const size = Number(face);
        const board = openBoard(8, 8);
        const blob = growBlob(8, 8, size, picks);
        const move: Move = {
          playerId: 'p1',
          round: 0,
          choice: { kind: 'fallback', blobs: [blob] },
        };
        const result = applyMove(board, rollWithFallback(face), move);
        expect(result.ok).toBe(true);
      }),
    );
  });

  it('a compound face accepts two same-sized-as-required, non-overlapping contiguous blobs', () => {
    fc.assert(
      fc.property(picksArbitrary, picksArbitrary, (picksA, picksB) => {
        // '1+2': one 1-cell blob near the board centre, one 2-cell blob grown
        // from a corner far enough away that the two can never collide.
        const board = openBoard(10, 10);
        const blobA = growBlob(10, 10, 1, picksA);
        const blobB = growCornerBlob(picksB);
        const move: Move = {
          playerId: 'p1',
          round: 0,
          choice: { kind: 'fallback', blobs: [blobA, blobB] },
        };
        const result = applyMove(board, rollWithFallback('1+2'), move);
        expect(result.ok).toBe(true);
      }),
    );

    function growCornerBlob(picks: readonly number[]): CellRef[] {
      // Grows from (0,0) instead of the board centre, guaranteeing no overlap
      // with a centre-grown 1-cell blob on a 10x10 board.
      const included: CellRef[] = [{ x: 0, y: 0 }];
      const includedKeys = new Set(['0,0']);
      let pickIndex = 0;
      while (included.length < 2) {
        const frontier = new Map<string, CellRef>();
        for (const cell of included) {
          for (const neighbor of [
            { x: cell.x + 1, y: cell.y },
            { x: cell.x, y: cell.y + 1 },
          ]) {
            const key = `${neighbor.x},${neighbor.y}`;
            if (!includedKeys.has(key)) frontier.set(key, neighbor);
          }
        }
        const options = [...frontier.values()];
        const pick = options[picks[pickIndex % picks.length]! % options.length]!;
        included.push(pick);
        includedKeys.add(`${pick.x},${pick.y}`);
        pickIndex += 1;
      }
      return included;
    }
  });
});

describe('applyMove — property: an illegal fallback move is never accepted', () => {
  it('two deliberately overlapping blobs for a compound face are always rejected', () => {
    fc.assert(
      fc.property(picksArbitrary, (picks) => {
        const board = openBoard(8, 8);
        const blobA = growBlob(8, 8, 1, picks);
        // blobB deliberately reuses blobA's one cell as one of its own two —
        // its second cell must stay a genuine orthogonal neighbor (no wraparound),
        // or the contiguity check would reject it first for the wrong reason.
        const shared = blobA[0]!;
        const neighborX = shared.x < 7 ? shared.x + 1 : shared.x - 1;
        const blobB = [shared, { x: neighborX, y: shared.y }];
        const move: Move = {
          playerId: 'p1',
          round: 0,
          choice: { kind: 'fallback', blobs: [blobA, blobB] },
        };
        const result = applyMove(board, rollWithFallback('1+2'), move);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).toBe('overlapping-placement');
      }),
    );
  });

  it('an adjacent blob straddling the right edge is always rejected as out-of-bounds', () => {
    // Deliberately kept to a genuinely adjacent (contiguous) pair — an
    // arbitrary "overshoot by N" generator would sometimes also produce a
    // non-contiguous blob, and applyMove checks contiguity before bounds, so
    // that version was asserting a rejection *reason* its own inputs didn't
    // actually guarantee.
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 10 }), (width) => {
        const board = openBoard(width, 4);
        const move: Move = {
          playerId: 'p1',
          round: 0,
          choice: {
            kind: 'fallback',
            blobs: [
              [
                { x: width - 1, y: 0 },
                { x: width, y: 0 },
              ],
            ],
          },
        };
        const result = applyMove(board, rollWithFallback('2'), move);
        expect(result).toEqual({ ok: false, reason: 'out-of-bounds' });
      }),
    );
  });

  it('a blob landing on an already-filled cell is always rejected', () => {
    fc.assert(
      fc.property(picksArbitrary, (picks) => {
        const openCells = openBoard(8, 8).cells.slice();
        // growBlob always starts at the board's centre cell (4,4) — a
        // 1-cell blob is exactly that cell, so filling it in advance
        // guarantees the collision this test means to exercise.
        const centreIndex = 4 * 8 + 4;
        openCells[centreIndex] = 'filled';
        const board: Board = { ...openBoard(8, 8), cells: openCells };
        const blob = growBlob(8, 8, 1, picks);
        const move: Move = {
          playerId: 'p1',
          round: 0,
          choice: { kind: 'fallback', blobs: [blob] },
        };
        const result = applyMove(board, rollWithFallback('1'), move);
        expect(result).toEqual({ ok: false, reason: 'cell-already-filled' });
      }),
    );
  });
});
