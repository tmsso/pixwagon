import { describe, expect, it } from 'vitest';
import { ALL_ORIENTATIONS, SHAPE_LIBRARY, cellsAt } from '@pixwagon/game-core';
import type { Board, CellRef, CellState, Roll } from '@pixwagon/game-core';
import {
  activeCandidateCells,
  candidateCells,
  clearActive,
  isPendingComplete,
  mirrorActivePiece,
  placeActive,
  rotateActivePiece,
  setActive,
  startFallback,
  startPair,
  toggleBlobCell,
  toMoveChoice,
  defaultAnchor,
  originFor,
  pendingProblem,
  pieceCellsAt,
  problemText,
  type PendingChoice,
} from './placement.ts';

const pairRoll: Roll = { round: 1, seed: 's', pair: ['domino', 'monomino'], fallback: '1+2' };

describe('pair placement', () => {
  it('starts with neither piece placed', () => {
    const choice = startPair(pairRoll);
    expect(isPendingComplete(choice)).toBe(false);
    expect(candidateCells(choice)).toEqual([]);
  });

  it('placing the active piece auto-advances focus to the other unplaced piece', () => {
    let choice = startPair(pairRoll);
    choice = placeActive(choice, { x: 2, y: 3 });
    expect(choice.kind).toBe('pair');
    if (choice.kind !== 'pair') throw new Error('unreachable');
    expect(choice.pieces[0].at).toEqual({ x: 2, y: 3 });
    expect(choice.active).toBe(1);
  });

  it('is complete once both pieces have an origin', () => {
    let choice = startPair(pairRoll);
    choice = placeActive(choice, { x: 0, y: 0 });
    choice = placeActive(choice, { x: 5, y: 5 });
    expect(isPendingComplete(choice)).toBe(true);
  });

  it('rotate only affects the active piece', () => {
    let choice = startPair(pairRoll);
    choice = rotateActivePiece(choice);
    if (choice.kind !== 'pair') throw new Error('unreachable');
    expect(choice.pieces[0].orientation.rotation).toBe(90);
    expect(choice.pieces[1].orientation.rotation).toBe(0);
  });

  it('mirror toggles independently of rotation', () => {
    let choice = startPair(pairRoll);
    choice = mirrorActivePiece(choice);
    if (choice.kind !== 'pair') throw new Error('unreachable');
    expect(choice.pieces[0].orientation).toEqual({ rotation: 0, mirrored: true });
  });

  it("clearActive undoes only the active piece's placement", () => {
    let choice = startPair(pairRoll);
    choice = placeActive(choice, { x: 1, y: 1 }); // places piece 0, advances to piece 1
    choice = setActive(choice, 0);
    choice = clearActive(choice);
    if (choice.kind !== 'pair') throw new Error('unreachable');
    expect(choice.pieces[0].at).toBeNull();
  });

  it('builds the atomic MoveChoice once complete', () => {
    let choice = startPair(pairRoll);
    choice = placeActive(choice, { x: 0, y: 0 });
    choice = placeActive(choice, { x: 4, y: 4 });
    const move = toMoveChoice(choice);
    expect(move.kind).toBe('pair');
    if (move.kind !== 'pair') throw new Error('unreachable');
    expect(move.placements).toHaveLength(2);
  });

  it('throws building a MoveChoice from an incomplete pair', () => {
    const choice = startPair(pairRoll);
    expect(() => toMoveChoice(choice)).toThrow();
  });

  it('activeCandidateCells is only the active piece, and is a subset of candidateCells', () => {
    let choice = startPair(pairRoll); // pair: domino (2 cells) + monomino (1 cell)
    choice = placeActive(choice, { x: 2, y: 3 }); // places piece 0, active -> 1
    choice = placeActive(choice, { x: 7, y: 7 }); // places piece 1, still active 1

    const all = candidateCells(choice);
    const active = activeCandidateCells(choice);
    expect(all.length).toBe(3);
    expect(active).toEqual([{ x: 7, y: 7 }]); // the monomino, piece 1
    for (const cell of active) {
      expect(all).toContainEqual(cell);
    }

    choice = setActive(choice, 0);
    expect(activeCandidateCells(choice)).toHaveLength(2); // now the domino
  });

  it('activeCandidateCells is empty while the active piece has no origin', () => {
    const choice = startPair(pairRoll);
    expect(activeCandidateCells(choice)).toEqual([]);
  });
});

describe('fallback blob placement', () => {
  it('starts with a blob per required size, all empty', () => {
    const choice = startFallback(pairRoll); // '1+2'
    expect(choice.kind).toBe('fallback');
    if (choice.kind !== 'fallback') throw new Error('unreachable');
    expect(choice.blobs.map((b) => b.size)).toEqual([1, 2]);
    expect(isPendingComplete(choice)).toBe(false);
  });

  it('toggling a cell adds it, toggling again removes it', () => {
    let choice = startFallback(pairRoll);
    choice = toggleBlobCell(choice, { x: 1, y: 1 });
    expect(candidateCells(choice)).toEqual([{ x: 1, y: 1 }]);
    choice = toggleBlobCell(choice, { x: 1, y: 1 });
    expect(candidateCells(choice)).toEqual([]);
  });

  it('a full blob hands the next tap to the next blob (compound faces)', () => {
    let choice = startFallback(pairRoll); // blobs [1, 2]
    choice = toggleBlobCell(choice, { x: 0, y: 0 });
    choice = toggleBlobCell(choice, { x: 9, y: 9 });
    if (choice.kind !== 'fallback') throw new Error('unreachable');
    expect(choice.blobs[0]?.cells).toEqual([{ x: 0, y: 0 }]);
    expect(choice.blobs[1]?.cells).toEqual([{ x: 9, y: 9 }]);
    expect(choice.active).toBe(1);
  });

  it('a tap that does not touch the active blob restarts it there', () => {
    const roll: Roll = { ...pairRoll, fallback: '3' };
    let choice = startFallback(roll);
    choice = toggleBlobCell(choice, { x: 1, y: 1 });
    choice = toggleBlobCell(choice, { x: 2, y: 1 });
    choice = toggleBlobCell(choice, { x: 6, y: 6 });
    expect(candidateCells(choice)).toEqual([{ x: 6, y: 6 }]);
  });

  it('removing a square that splits a blob keeps the larger part', () => {
    const roll: Roll = { ...pairRoll, fallback: '3' };
    let choice = startFallback(roll);
    for (const x of [1, 2, 3]) choice = toggleBlobCell(choice, { x, y: 1 });
    choice = toggleBlobCell(choice, { x: 2, y: 1 });
    expect(candidateCells(choice)).toHaveLength(1);
  });

  it('ignores taps on squares that cannot be filled when given the board', () => {
    const roll: Roll = { ...pairRoll, fallback: '2' };
    const board = twoHoleBoard();
    const choice = toggleBlobCell(startFallback(roll), { x: 0, y: 0 }, board);
    expect(candidateCells(choice)).toEqual([]);
  });

  it('is complete once every blob has its required cell count', () => {
    let choice = startFallback(pairRoll);
    choice = toggleBlobCell(choice, { x: 0, y: 0 });
    choice = setActive(choice, 1);
    choice = toggleBlobCell(choice, { x: 5, y: 5 });
    choice = toggleBlobCell(choice, { x: 5, y: 6 });
    expect(isPendingComplete(choice)).toBe(true);
  });

  it('activeCandidateCells follows the active blob', () => {
    let choice = startFallback(pairRoll); // blobs [1, 2]
    choice = toggleBlobCell(choice, { x: 0, y: 0 }); // fills blob 0 (size 1)
    choice = setActive(choice, 1);
    choice = toggleBlobCell(choice, { x: 5, y: 5 });

    expect(activeCandidateCells(choice)).toEqual([{ x: 5, y: 5 }]);
    expect(candidateCells(choice)).toHaveLength(2);

    choice = setActive(choice, 0);
    expect(activeCandidateCells(choice)).toEqual([{ x: 0, y: 0 }]);
  });

  it('builds a fallback MoveChoice with one cell array per blob', () => {
    let choice = startFallback(pairRoll);
    choice = toggleBlobCell(choice, { x: 0, y: 0 });
    choice = setActive(choice, 1);
    choice = toggleBlobCell(choice, { x: 5, y: 5 });
    choice = toggleBlobCell(choice, { x: 5, y: 6 });
    const move = toMoveChoice(choice);
    expect(move.kind).toBe('fallback');
    if (move.kind !== 'fallback') throw new Error('unreachable');
    expect(move.blobs).toEqual([
      [{ x: 0, y: 0 }],
      [
        { x: 5, y: 5 },
        { x: 5, y: 6 },
      ],
    ]);
  });
});

/** The owner's report (2026-11-05): two lone 1×1 holes surrounded by filled
 *  squares. 5×3, everything filled except (1,1) and (3,1). */
function twoHoleBoard(): Board {
  const cells: CellState[] = Array.from({ length: 15 }, () => 'filled');
  cells[1 * 5 + 1] = 'fillable';
  cells[1 * 5 + 3] = 'fillable';
  return { size: { width: 5, height: 3 }, packId: 'test', pictureId: 'test', cells };
}

describe('the two-lone-holes report (pass 04)', () => {
  it('a 2 is one connected group: two holes that do not touch cannot both be staged', () => {
    const roll: Roll = { ...pairRoll, fallback: '2' };
    let choice = startFallback(roll);
    choice = toggleBlobCell(choice, { x: 1, y: 1 }, twoHoleBoard());
    choice = toggleBlobCell(choice, { x: 3, y: 1 }, twoHoleBoard());
    // The second tap restarts the group rather than composing an illegal move.
    expect(candidateCells(choice)).toEqual([{ x: 3, y: 1 }]);
    expect(pendingProblem(twoHoleBoard(), roll, choice)).toBe('incomplete');
  });

  it('Place is gated on the rules engine, not on the square count', () => {
    const roll: Roll = { ...pairRoll, fallback: '2' };
    // Composed without the board's help (as an older client could): the
    // count is right, the move is still not legal.
    const choice: PendingChoice = {
      kind: 'fallback',
      blobs: [
        {
          size: 2,
          cells: [
            { x: 1, y: 1 },
            { x: 3, y: 1 },
          ],
        },
      ],
      active: 0,
    };
    expect(isPendingComplete(choice)).toBe(true);
    expect(pendingProblem(twoHoleBoard(), roll, choice)).toBe('blob-not-contiguous');
    expect(problemText('blob-not-contiguous')).toMatch(/touch/);
  });

  it('a 1 fills one lone hole and is legal', () => {
    const roll: Roll = { ...pairRoll, fallback: '1' };
    const choice = toggleBlobCell(startFallback(roll), { x: 1, y: 1 }, twoHoleBoard());
    expect(pendingProblem(twoHoleBoard(), roll, choice)).toBeNull();
  });

  it('a 1+2 no longer drops the second tap', () => {
    const roll: Roll = { ...pairRoll, fallback: '1+2' };
    let choice = startFallback(roll);
    choice = toggleBlobCell(choice, { x: 0, y: 0 });
    choice = toggleBlobCell(choice, { x: 4, y: 0 });
    choice = toggleBlobCell(choice, { x: 4, y: 1 });
    expect(isPendingComplete(choice)).toBe(true);
  });
});

describe('anchors (pass 04): the tapped square is always part of the piece', () => {
  const at = { x: 6, y: 6 };
  for (const piece of SHAPE_LIBRARY) {
    for (const orientation of ALL_ORIENTATIONS) {
      const label = `${piece.id} ${orientation.rotation}°${orientation.mirrored ? ' mirrored' : ''}`;
      it(`${label}: every anchor covers the tapped square and agrees with game-core`, () => {
        piece.cells.forEach((_, anchor) => {
          const pending = { pieceId: piece.id, orientation, anchor };
          const cells = pieceCellsAt(pending, at);
          expect(cells).toContainEqual(at);
          // The wire origin reproduces exactly the same squares in game-core.
          const origin = originFor(pending, at);
          const viaCore = cellsAt(piece, orientation).map((o) => ({
            x: origin.x + o.dx,
            y: origin.y + o.dy,
          }));
          expect(sortCells(viaCore)).toEqual(sortCells(cells));
        });
      });
    }
  }

  it('turning and flipping a staged piece pivot on its anchor', () => {
    const roll: Roll = { round: 1, seed: 's', pair: ['tetromino-s', 'tetromino-t'], fallback: '1' };
    let choice = setActive(startPair(roll), 0);
    choice = placeActive(choice, at);
    choice = setActive(choice, 0);
    for (let i = 0; i < 4; i += 1) {
      choice = rotateActivePiece(choice);
      expect(activeCandidateCells(choice)).toContainEqual(at);
    }
    choice = mirrorActivePiece(choice);
    expect(activeCandidateCells(choice)).toContainEqual(at);
  });

  it('the default anchor sits inside the piece, near its middle', () => {
    // The S tetromino's bounding-box top-left (0,0) is empty; its handle is not.
    const s = SHAPE_LIBRARY.find((p) => p.id === 'tetromino-s')!;
    const handle = s.cells[defaultAnchor('tetromino-s')]!;
    expect([handle.dx, handle.dy]).not.toEqual([0, 0]);
    expect(defaultAnchor('monomino')).toBe(0);
  });
});

function sortCells(cells: readonly CellRef[]): CellRef[] {
  return [...cells].sort((a, b) => a.y - b.y || a.x - b.x);
}
