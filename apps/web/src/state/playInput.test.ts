import { describe, expect, it } from 'vitest';
import type { Board, CellState, Roll } from '@pixwagon/game-core';
import {
  ghostAt,
  hasStaged,
  heldPiece,
  keyAction,
  loneSquaresAfter,
  mirrorPiece,
  pickUp,
  rotatePiece,
  selectTile,
  stagedFits,
  stagedPieceAt,
  undo,
} from './playInput.ts';
import {
  candidateCells,
  placeActive,
  startFallback,
  startPair,
  toggleBlobCell,
} from './placement.ts';

const roll: Roll = { round: 0, seed: 's', pair: ['domino', 'tromino-l'], fallback: '1+2' };

function openBoard(width = 8, height = 6): Board {
  return {
    size: { width, height },
    packId: 't',
    pictureId: 't',
    cells: Array.from({ length: width * height }, () => 'fillable' as CellState),
  };
}

describe('holding and staging', () => {
  it('a fresh pair holds its first piece', () => {
    expect(heldPiece(startPair(roll))?.pieceId).toBe('domino');
  });

  it('staging hands the hold to the other piece; with both staged nothing is held', () => {
    let choice = placeActive(startPair(roll), { x: 1, y: 1 });
    expect(heldPiece(choice)?.pieceId).toBe('tromino-l');
    choice = placeActive(choice, { x: 5, y: 3 });
    expect(heldPiece(choice)).toBeNull();
  });

  it('finds which staged piece covers a square', () => {
    const choice = placeActive(startPair(roll), { x: 1, y: 1 });
    const cells = candidateCells(choice);
    expect(stagedPieceAt(choice, cells[0]!)).toBe(0);
    expect(stagedPieceAt(choice, { x: 7, y: 5 })).toBeNull();
  });

  it('picking a staged piece up by one of its squares keeps that square under the pointer', () => {
    let choice = placeActive(startPair(roll), { x: 3, y: 3 });
    const grabbed = candidateCells(choice).find((c) => c.x !== 3 || c.y !== 3)!;
    choice = pickUp(choice, 0, grabbed);
    expect(heldPiece(choice)?.pieceId).toBe('domino');
    const ghost = ghostAt(openBoard(), choice, grabbed)!;
    expect(ghost.cells).toContainEqual(grabbed);
    // Dropped where it was grabbed, it lands on exactly the same squares.
    const again = placeActive(choice, grabbed);
    expect(candidateCells(again)).toEqual(expect.arrayContaining([{ x: 3, y: 3 }, grabbed]));
  });

  it('rotate and mirror act on the named piece and leave the other alone', () => {
    let choice = placeActive(startPair(roll), { x: 2, y: 2 });
    const before = candidateCells(choice);
    choice = rotatePiece(choice, 1);
    choice = mirrorPiece(choice, 1);
    expect(candidateCells(choice)).toEqual(before);
    choice = rotatePiece(choice, 0);
    expect(candidateCells(choice)).not.toEqual(before);
    expect(candidateCells(choice)).toContainEqual({ x: 2, y: 2 });
  });
});

describe('tray tiles', () => {
  it('a tile from the other offer switches the choice and empties the board', () => {
    let choice = selectTile(null, roll, 'pair', 1);
    expect(choice.kind === 'pair' && choice.active).toBe(1);
    choice = placeActive(choice, { x: 2, y: 2 });
    choice = selectTile(choice, roll, 'fallback', 0);
    expect(choice.kind).toBe('fallback');
    expect(hasStaged(choice)).toBe(false);
  });

  it("a staged piece's own tile picks it back up", () => {
    let choice = placeActive(selectTile(null, roll, 'pair', 0), { x: 2, y: 2 });
    choice = selectTile(choice, roll, 'pair', 0);
    expect(heldPiece(choice)?.pieceId).toBe('domino');
  });

  it('a single tile makes that blob the one being painted', () => {
    const choice = selectTile(null, roll, 'fallback', 1);
    expect(choice.kind === 'fallback' && choice.active).toBe(1);
  });
});

describe('the ghost', () => {
  it('fits on open squares and not off the picture or over a staged piece', () => {
    let choice = startPair(roll);
    const board = openBoard();
    expect(ghostAt(board, choice, { x: 3, y: 3 })?.fits).toBe(true);
    expect(ghostAt(board, choice, { x: 7, y: 5 })?.fits).toBe(false);
    choice = placeActive(choice, { x: 3, y: 3 });
    // The held tromino over the staged domino.
    expect(ghostAt(board, choice, { x: 3, y: 3 })?.fits).toBe(false);
  });

  it('there is no ghost without a hover square or a held piece', () => {
    expect(ghostAt(openBoard(), startPair(roll), null)).toBeNull();
    expect(ghostAt(openBoard(), startFallback(roll), { x: 1, y: 1 })).toBeNull();
  });
});

describe('undo', () => {
  it('takes back the most recent piece first', () => {
    let choice = placeActive(startPair(roll), { x: 1, y: 1 });
    choice = placeActive(choice, { x: 5, y: 3 });
    choice = undo(choice);
    expect(heldPiece(choice)?.pieceId).toBe('tromino-l');
    choice = undo(choice);
    expect(hasStaged(choice)).toBe(false);
    expect(undo(choice)).toEqual(choice);
  });

  it('takes back the last painted square, stepping back into the previous blob', () => {
    let choice = startFallback(roll); // 1+2
    choice = toggleBlobCell(choice, { x: 0, y: 0 });
    choice = toggleBlobCell(choice, { x: 4, y: 4 });
    choice = undo(choice);
    expect(candidateCells(choice)).toEqual([{ x: 0, y: 0 }]);
    choice = undo(choice);
    expect(hasStaged(choice)).toBe(false);
  });
});

describe('lone squares (D20)', () => {
  it('warns about a square this move leaves with no fillable neighbour', () => {
    // A 3×1 strip: covering the middle and right leaves the left alone.
    const board = openBoard(3, 1);
    expect(loneSquaresAfter(board, [{ x: 1, y: 0 }])).toEqual(
      expect.arrayContaining([
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ]),
    );
    expect(
      loneSquaresAfter(board, [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ]),
    ).toEqual([{ x: 0, y: 0 }]);
  });

  it('does not report a square that was already alone', () => {
    const cells: CellState[] = ['fillable', 'filled', 'fillable', 'fillable'];
    const board: Board = { size: { width: 4, height: 1 }, packId: 't', pictureId: 't', cells };
    expect(loneSquaresAfter(board, [{ x: 3, y: 0 }])).toEqual([{ x: 2, y: 0 }]);
  });
});

describe('keys', () => {
  it('maps the gesture table', () => {
    expect(keyAction('r')).toEqual({ kind: 'rotate' });
    expect(keyAction('F')).toEqual({ kind: 'mirror' });
    expect(keyAction('Backspace')).toEqual({ kind: 'undo' });
    expect(keyAction('Escape')).toEqual({ kind: 'cancel' });
    expect(keyAction('2')).toEqual({ kind: 'select', tile: 1 });
    expect(keyAction('x')).toBeNull();
  });
});

describe('stagedFits', () => {
  it('is false once a turn swings a staged piece off the picture', () => {
    const board = openBoard(3, 3);
    // An I-tromino lying along the bottom row, handle in the middle.
    let choice = placeActive(startPair({ ...roll, pair: ['tromino-i', 'domino'] }), { x: 1, y: 2 });
    expect(stagedFits(board, choice, 0)).toBe(true);
    choice = rotatePiece(choice, 0); // now vertical through (1,2): pokes out below
    expect(stagedFits(board, choice, 0)).toBe(false);
  });
});
