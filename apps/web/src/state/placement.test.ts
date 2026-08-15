import { describe, expect, it } from 'vitest';
import type { Roll } from '@pixwagon/game-core';
import {
  candidateCells,
  clearActive,
  isPendingComplete,
  mirrorActivePiece,
  placeActiveOrigin,
  rotateActivePiece,
  setActive,
  startFallback,
  startPair,
  toggleBlobCell,
  toMoveChoice,
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
    choice = placeActiveOrigin(choice, { x: 2, y: 3 });
    expect(choice.kind).toBe('pair');
    if (choice.kind !== 'pair') throw new Error('unreachable');
    expect(choice.pieces[0].origin).toEqual({ x: 2, y: 3 });
    expect(choice.active).toBe(1);
  });

  it('is complete once both pieces have an origin', () => {
    let choice = startPair(pairRoll);
    choice = placeActiveOrigin(choice, { x: 0, y: 0 });
    choice = placeActiveOrigin(choice, { x: 5, y: 5 });
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
    choice = placeActiveOrigin(choice, { x: 1, y: 1 }); // places piece 0, advances to piece 1
    choice = setActive(choice, 0);
    choice = clearActive(choice);
    if (choice.kind !== 'pair') throw new Error('unreachable');
    expect(choice.pieces[0].origin).toBeNull();
  });

  it('builds the atomic MoveChoice once complete', () => {
    let choice = startPair(pairRoll);
    choice = placeActiveOrigin(choice, { x: 0, y: 0 });
    choice = placeActiveOrigin(choice, { x: 4, y: 4 });
    const move = toMoveChoice(choice);
    expect(move.kind).toBe('pair');
    if (move.kind !== 'pair') throw new Error('unreachable');
    expect(move.placements).toHaveLength(2);
  });

  it('throws building a MoveChoice from an incomplete pair', () => {
    const choice = startPair(pairRoll);
    expect(() => toMoveChoice(choice)).toThrow();
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

  it('refuses a cell past the blob size instead of overflowing it', () => {
    let choice = startFallback(pairRoll);
    // active blob is the size-1 one
    choice = toggleBlobCell(choice, { x: 0, y: 0 });
    choice = toggleBlobCell(choice, { x: 9, y: 9 });
    if (choice.kind !== 'fallback') throw new Error('unreachable');
    expect(choice.blobs[0]?.cells).toEqual([{ x: 0, y: 0 }]);
  });

  it('is complete once every blob has its required cell count', () => {
    let choice = startFallback(pairRoll);
    choice = toggleBlobCell(choice, { x: 0, y: 0 });
    choice = setActive(choice, 1);
    choice = toggleBlobCell(choice, { x: 5, y: 5 });
    choice = toggleBlobCell(choice, { x: 5, y: 6 });
    expect(isPendingComplete(choice)).toBe(true);
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
