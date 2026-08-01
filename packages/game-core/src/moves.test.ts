import { describe, expect, it } from 'vitest';
import { createBoard, isComplete } from './board.js';
import { applyMove, legalCellsFor } from './moves.js';
import { issueRoll } from './roll.js';
import { cellsAt, getPiece } from './shapes.js';
import type { PieceId } from './shapes.js';
import { FALLBACK_BLOB_SIZES } from './types.js';
import type { Board, CellRef, CellState, Move, Roll } from './types.js';

function board(width: number, height: number, overrides: Record<string, CellState> = {}): Board {
  const cells: CellState[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      cells.push(overrides[`${x},${y}`] ?? 'fillable');
    }
  }
  return { size: { width, height }, packId: 'test', pictureId: 'test', cells };
}

function roll(overrides: Partial<Roll> = {}): Roll {
  return { round: 0, seed: 'test', pair: ['domino', 'tromino-i'], fallback: '2', ...overrides };
}

const identity = { rotation: 0 as const, mirrored: false };

describe('applyMove — rejections (every MoveRejection variant)', () => {
  it('wrong-round: a move for a round other than the one in force', () => {
    const b = board(6, 6);
    const r = roll({ round: 5 });
    const move: Move = {
      playerId: 'p1',
      round: 4,
      choice: {
        kind: 'fallback',
        blobs: [
          [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
          ],
        ],
      },
    };
    expect(applyMove(b, r, move)).toEqual({ ok: false, reason: 'wrong-round' });
  });

  it('unknown-piece: a pair placement naming an id outside the shape library', () => {
    const b = board(6, 6);
    const r = roll();
    const move: Move = {
      playerId: 'p1',
      round: 0,
      choice: {
        kind: 'pair',
        placements: [
          { pieceId: 'not-a-real-piece' as PieceId, orientation: identity, origin: { x: 0, y: 0 } },
          { pieceId: 'tromino-i', orientation: identity, origin: { x: 3, y: 0 } },
        ],
      },
    };
    expect(applyMove(b, r, move)).toEqual({ ok: false, reason: 'unknown-piece' });
  });

  it("not-offered: two real pieces that aren't this round's pair", () => {
    const b = board(6, 6);
    const r = roll({ pair: ['domino', 'tromino-i'] });
    const move: Move = {
      playerId: 'p1',
      round: 0,
      choice: {
        kind: 'pair',
        placements: [
          { pieceId: 'monomino', orientation: identity, origin: { x: 0, y: 0 } },
          { pieceId: 'tetromino-o', orientation: identity, origin: { x: 2, y: 0 } },
        ],
      },
    };
    expect(applyMove(b, r, move)).toEqual({ ok: false, reason: 'not-offered' });
  });

  it('not-offered: the same offered piece claimed twice does not satisfy a two-distinct-piece pair', () => {
    const b = board(6, 6);
    const r = roll({ pair: ['domino', 'tromino-i'] });
    const move: Move = {
      playerId: 'p1',
      round: 0,
      choice: {
        kind: 'pair',
        placements: [
          { pieceId: 'domino', orientation: identity, origin: { x: 0, y: 0 } },
          { pieceId: 'domino', orientation: identity, origin: { x: 3, y: 0 } },
        ],
      },
    };
    expect(applyMove(b, r, move)).toEqual({ ok: false, reason: 'not-offered' });
  });

  it('out-of-bounds: a placement extending past the board edge', () => {
    const b = board(3, 3);
    const r = roll({ pair: ['domino', 'tromino-i'] });
    const move: Move = {
      playerId: 'p1',
      round: 0,
      choice: {
        kind: 'pair',
        placements: [
          // domino at (2,0)-(3,0): x=3 is outside a width-3 board
          { pieceId: 'domino', orientation: identity, origin: { x: 2, y: 0 } },
          { pieceId: 'tromino-i', orientation: identity, origin: { x: 0, y: 1 } },
        ],
      },
    };
    expect(applyMove(b, r, move)).toEqual({ ok: false, reason: 'out-of-bounds' });
  });

  it('cell-not-fillable: a placement landing on a blank cell', () => {
    const b = board(6, 6, { '1,0': 'blank' });
    const r = roll({ pair: ['domino', 'tromino-i'] });
    const move: Move = {
      playerId: 'p1',
      round: 0,
      choice: {
        kind: 'pair',
        placements: [
          { pieceId: 'domino', orientation: identity, origin: { x: 0, y: 0 } },
          { pieceId: 'tromino-i', orientation: identity, origin: { x: 0, y: 2 } },
        ],
      },
    };
    expect(applyMove(b, r, move)).toEqual({ ok: false, reason: 'cell-not-fillable' });
  });

  it('cell-already-filled: a placement landing on an already-filled cell', () => {
    const b = board(6, 6, { '1,0': 'filled' });
    const r = roll({ pair: ['domino', 'tromino-i'] });
    const move: Move = {
      playerId: 'p1',
      round: 0,
      choice: {
        kind: 'pair',
        placements: [
          { pieceId: 'domino', orientation: identity, origin: { x: 0, y: 0 } },
          { pieceId: 'tromino-i', orientation: identity, origin: { x: 0, y: 2 } },
        ],
      },
    };
    expect(applyMove(b, r, move)).toEqual({ ok: false, reason: 'cell-already-filled' });
  });

  it('overlapping-placement: a pair whose two placements share a cell', () => {
    const b = board(6, 6);
    const r = roll({ pair: ['domino', 'tromino-i'] });
    const move: Move = {
      playerId: 'p1',
      round: 0,
      choice: {
        kind: 'pair',
        // Both at origin (0,0), horizontal: domino covers (0,0),(1,0); tromino-i covers (0,0),(1,0),(2,0).
        placements: [
          { pieceId: 'domino', orientation: identity, origin: { x: 0, y: 0 } },
          { pieceId: 'tromino-i', orientation: identity, origin: { x: 0, y: 0 } },
        ],
      },
    };
    expect(applyMove(b, r, move)).toEqual({ ok: false, reason: 'overlapping-placement' });
  });

  it('overlapping-placement: two fallback blobs sharing a cell', () => {
    const b = board(6, 6);
    const r = roll({ fallback: '1+2' });
    const move: Move = {
      playerId: 'p1',
      round: 0,
      choice: {
        kind: 'fallback',
        blobs: [
          [{ x: 0, y: 0 }],
          [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
          ],
        ],
      },
    };
    expect(applyMove(b, r, move)).toEqual({ ok: false, reason: 'overlapping-placement' });
  });

  it('blob-size-mismatch: right blob count, wrong cell count', () => {
    const b = board(6, 6);
    const r = roll({ fallback: '2' });
    const move: Move = {
      playerId: 'p1',
      round: 0,
      choice: {
        kind: 'fallback',
        blobs: [
          [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 2, y: 0 },
          ],
        ],
      },
    };
    expect(applyMove(b, r, move)).toEqual({ ok: false, reason: 'blob-size-mismatch' });
  });

  it('blob-not-contiguous: a blob whose cells are not orthogonally connected', () => {
    const b = board(6, 6);
    const r = roll({ fallback: '2' });
    const move: Move = {
      playerId: 'p1',
      round: 0,
      choice: {
        kind: 'fallback',
        blobs: [
          [
            { x: 0, y: 0 },
            { x: 4, y: 4 },
          ],
        ],
      },
    };
    expect(applyMove(b, r, move)).toEqual({ ok: false, reason: 'blob-not-contiguous' });
  });

  it('incomplete-compound-choice: only one blob supplied for a compound face', () => {
    const b = board(6, 6);
    const r = roll({ fallback: '1+2' });
    const move: Move = {
      playerId: 'p1',
      round: 0,
      choice: { kind: 'fallback', blobs: [[{ x: 0, y: 0 }]] },
    };
    expect(applyMove(b, r, move)).toEqual({ ok: false, reason: 'incomplete-compound-choice' });
  });

  it('incomplete-compound-choice: a bare face given two blobs instead of one', () => {
    const b = board(6, 6);
    const r = roll({ fallback: '2' });
    const move: Move = {
      playerId: 'p1',
      round: 0,
      choice: {
        kind: 'fallback',
        blobs: [[{ x: 0, y: 0 }], [{ x: 3, y: 3 }]],
      },
    };
    expect(applyMove(b, r, move)).toEqual({ ok: false, reason: 'incomplete-compound-choice' });
  });
});

describe('applyMove — accepted moves', () => {
  it('accepts a legal pair placement and fills exactly its cells', () => {
    const b = board(6, 6);
    const r = roll({ pair: ['domino', 'tromino-i'] });
    const move: Move = {
      playerId: 'p1',
      round: 0,
      choice: {
        kind: 'pair',
        placements: [
          { pieceId: 'domino', orientation: identity, origin: { x: 0, y: 0 } },
          { pieceId: 'tromino-i', orientation: identity, origin: { x: 0, y: 2 } },
        ],
      },
    };
    const result = applyMove(b, r, move);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.board.cells[0]).toBe('filled'); // (0,0)
    expect(result.board.cells[1]).toBe('filled'); // (1,0)
    expect(result.board.cells[12]).toBe('filled'); // (0,2)
    expect(result.board.cells[2]).toBe('fillable'); // (2,0) untouched
  });

  it('accepts a legal bare-face fallback move', () => {
    const b = board(6, 6);
    const r = roll({ fallback: '3' });
    const move: Move = {
      playerId: 'p1',
      round: 0,
      choice: {
        kind: 'fallback',
        blobs: [
          [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 1 },
          ],
        ],
      },
    };
    const result = applyMove(b, r, move);
    expect(result.ok).toBe(true);
  });

  it('accepts a legal compound fallback move regardless of blob order', () => {
    const b = board(6, 6);
    const r = roll({ fallback: '1+2' });
    const move: Move = {
      playerId: 'p1',
      round: 0,
      choice: {
        kind: 'fallback',
        // Bigger blob first — matching should be by size multiset, not position.
        blobs: [
          [
            { x: 3, y: 3 },
            { x: 4, y: 3 },
          ],
          [{ x: 0, y: 0 }],
        ],
      },
    };
    expect(applyMove(b, r, move).ok).toBe(true);
  });

  it("doesn't mutate the input board (returns a new one)", () => {
    const b = board(4, 4);
    const before = b.cells.slice();
    const r = roll({ fallback: '1' });
    applyMove(b, r, {
      playerId: 'p1',
      round: 0,
      choice: { kind: 'fallback', blobs: [[{ x: 0, y: 0 }]] },
    });
    expect(b.cells).toEqual(before);
  });
});

describe('legalCellsFor', () => {
  it('finds no placements on a fully-blank board', () => {
    const b = board(
      4,
      4,
      Object.fromEntries(
        Array.from({ length: 16 }, (_, i) => [`${i % 4},${Math.floor(i / 4)}`, 'blank' as const]),
      ),
    );
    expect(legalCellsFor(b, 'domino')).toHaveLength(0);
  });

  it('finds every orientation/origin where a piece fits an open board', () => {
    const b = board(3, 1); // exactly wide enough for one horizontal domino orientation, twice
    const placements = legalCellsFor(b, 'domino');
    // Domino has 2 distinct orientations (horizontal, vertical); only horizontal
    // fits a height-1 board, at origins (0,0) and (1,0).
    expect(placements).toHaveLength(2);
    for (const placement of placements) {
      expect(placement.orientation.rotation === 0 || placement.orientation.rotation === 180).toBe(
        true,
      );
    }
  });

  it('every placement legalCellsFor finds is accepted by applyMove', () => {
    const b = board(5, 5);
    const r = roll({ pair: ['domino', 'monomino'] });
    const placements = legalCellsFor(b, 'domino');
    expect(placements.length).toBeGreaterThan(0);

    const dominoAbsoluteCells = (
      origin: CellRef,
      orientation: (typeof placements)[number]['orientation'],
    ) =>
      cellsAt(getPiece('domino'), orientation).map((offset) => ({
        x: origin.x + offset.dx,
        y: origin.y + offset.dy,
      }));

    for (const placement of placements) {
      // Pair the domino placement with a monomino at whichever board corner
      // it doesn't occupy — a 5x5 board's 4 corners can't all be covered by
      // one domino's 2-cell footprint, so at least one is always free.
      const occupied = new Set(
        dominoAbsoluteCells(placement.origin, placement.orientation).map((c) => `${c.x},${c.y}`),
      );
      const corners: CellRef[] = [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 0, y: 4 },
        { x: 4, y: 4 },
      ];
      const freeCorner = corners.find((c) => !occupied.has(`${c.x},${c.y}`));
      if (!freeCorner) throw new Error('a domino cannot occupy all 4 corners of a 5x5 board');

      const move: Move = {
        playerId: 'p1',
        round: 0,
        choice: {
          kind: 'pair',
          placements: [
            { pieceId: 'domino', orientation: placement.orientation, origin: placement.origin },
            { pieceId: 'monomino', orientation: identity, origin: freeCorner },
          ],
        },
      };
      expect(applyMove(b, r, move).ok).toBe(true);
    }
  });
});

/**
 * Grows a `size`-cell contiguous blob from the first still-fillable cell
 * found (row-major scan), skipping cells in `avoid` (already claimed by an
 * earlier blob this same round). Used only by the greedy solver below, to
 * find *some* legal fallback move each round — not a claim about how a real
 * client would choose one.
 */
function findBlob(board: Board, size: number, avoid: Set<string>): CellRef[] | null {
  for (let y = 0; y < board.size.height; y += 1) {
    for (let x = 0; x < board.size.width; x += 1) {
      const key = `${x},${y}`;
      if (board.cells[y * board.size.width + x] !== 'fillable' || avoid.has(key)) continue;

      const included: CellRef[] = [{ x, y }];
      const includedKeys = new Set([key]);
      while (included.length < size) {
        let grew = false;
        for (const cell of [...included]) {
          const neighbors: CellRef[] = [
            { x: cell.x + 1, y: cell.y },
            { x: cell.x - 1, y: cell.y },
            { x: cell.x, y: cell.y + 1 },
            { x: cell.x, y: cell.y - 1 },
          ];
          for (const neighbor of neighbors) {
            const nKey = `${neighbor.x},${neighbor.y}`;
            if (includedKeys.has(nKey) || avoid.has(nKey)) continue;
            if (
              neighbor.x < 0 ||
              neighbor.y < 0 ||
              neighbor.x >= board.size.width ||
              neighbor.y >= board.size.height
            )
              continue;
            if (board.cells[neighbor.y * board.size.width + neighbor.x] !== 'fillable') continue;
            included.push(neighbor);
            includedKeys.add(nKey);
            grew = true;
            if (included.length === size) break;
          }
          if (included.length === size) break;
        }
        if (!grew) break; // stuck — this starting cell can't reach the required size
      }
      if (included.length === size) return included;
    }
  }
  return null;
}

describe('Phase 1 accept: a full board can be completed start to finish', () => {
  it('completes a real pack picture using real issueRoll offers (achievability, not just move mechanics)', () => {
    // Greedy solver: each round, take the pair if any two non-overlapping
    // legal placements exist for its two offered pieces; otherwise take the
    // fallback if its required blob(s) can be found; otherwise skip the
    // round entirely (no move exists yet — a later round's differently-shaped
    // offer may still open things up). "achievability-0" is a concrete
    // witness seed for which this converges within a small round budget on
    // the shipped tram picture (54 fillable cells) — found by search, not
    // assumed; ROADMAP.md Phase 1's Accept line only claims a favorable
    // sequence of rolls exists, not that every seed converges.
    let current = createBoard('transportation', 'tram');
    const seed = 'achievability-0';
    const maxRounds = 100;

    for (let round = 0; round < maxRounds && !isComplete(current); round += 1) {
      const r = issueRoll(seed, round);
      let applied = false;

      const [pieceA, pieceB] = r.pair;
      const placementsA = legalCellsFor(current, pieceA);
      const placementsB = legalCellsFor(current, pieceB);
      outer: for (const pa of placementsA) {
        for (const pb of placementsB) {
          const move: Move = {
            playerId: 'p1',
            round,
            choice: {
              kind: 'pair',
              placements: [
                { pieceId: pieceA, orientation: pa.orientation, origin: pa.origin },
                { pieceId: pieceB, orientation: pb.orientation, origin: pb.origin },
              ],
            },
          };
          const result = applyMove(current, r, move);
          if (result.ok) {
            current = result.board;
            applied = true;
            break outer;
          }
        }
      }

      if (!applied) {
        const sizes = FALLBACK_BLOB_SIZES[r.fallback];
        const avoid = new Set<string>();
        const blobs: CellRef[][] = [];
        for (const size of sizes) {
          const blob = findBlob(current, size, avoid);
          if (!blob) break;
          for (const cell of blob) avoid.add(`${cell.x},${cell.y}`);
          blobs.push(blob);
        }
        if (blobs.length === sizes.length) {
          const move: Move = { playerId: 'p1', round, choice: { kind: 'fallback', blobs } };
          const result = applyMove(current, r, move);
          if (result.ok) current = result.board;
        }
      }
    }

    expect(isComplete(current)).toBe(true);
  });
});
