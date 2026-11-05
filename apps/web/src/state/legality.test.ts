import { describe, expect, it } from 'vitest';
import type { Board, CellState } from '@pixwagon/game-core';
import { fallbackHasLegalPlacement, pairHasLegalPlacement } from './legality.ts';

function board(width: number, height: number, cells: readonly CellState[]): Board {
  return { size: { width, height }, packId: 'test', pictureId: 'test', cells };
}

describe('pairHasLegalPlacement', () => {
  it('is true on a wide-open board', () => {
    const b = board(4, 4, Array(16).fill('fillable'));
    expect(pairHasLegalPlacement(b, ['monomino', 'domino'])).toBe(true);
  });

  it('is false once the board has no room for both pieces without overlap', () => {
    // A single fillable cell can't hold a monomino and a domino at once.
    const b = board(1, 1, ['fillable']);
    expect(pairHasLegalPlacement(b, ['monomino', 'domino'])).toBe(false);
  });

  it('is false on a fully blank board', () => {
    const b = board(3, 3, Array(9).fill('blank'));
    expect(pairHasLegalPlacement(b, ['monomino', 'monomino'])).toBe(false);
  });
});

describe('fallbackHasLegalPlacement', () => {
  it('is true when a connected region big enough for the bare face exists', () => {
    const b = board(3, 1, ['fillable', 'fillable', 'fillable']);
    expect(fallbackHasLegalPlacement(b, '3')).toBe(true);
  });

  it('is false when no region is big enough', () => {
    // Three lone squares: more than a 2 totals, so "last squares" (D17)
    // doesn't apply, and no two of them touch.
    const b = board(5, 1, ['fillable', 'blank', 'fillable', 'blank', 'fillable']);
    expect(fallbackHasLegalPlacement(b, '2')).toBe(false);
  });

  it('is true for the last squares (D17): two lone holes and a 2', () => {
    const b = board(3, 1, ['fillable', 'blank', 'fillable']);
    expect(fallbackHasLegalPlacement(b, '2')).toBe(true);
  });

  it('is true for a compound face when a region covers each required size', () => {
    const b = board(5, 1, Array(5).fill('fillable'));
    expect(fallbackHasLegalPlacement(b, '1+2')).toBe(true);
  });

  it('is false for a compound face when nothing meets the larger required size', () => {
    // Four lone squares: more than 1+2 totals, and no two touch.
    const b = board(7, 1, [
      'fillable',
      'blank',
      'fillable',
      'blank',
      'fillable',
      'blank',
      'fillable',
    ]);
    expect(fallbackHasLegalPlacement(b, '1+2')).toBe(false);
  });

  it('is false for a compound face whose blobs fit one at a time but not together — a component-size-only check gets this wrong', () => {
    // A run of 3 and two lone squares. Each 2 of a 2+2 fits in the run on
    // its own, so a size-only heuristic says yes; together they need 4
    // squares the run doesn't have. Five squares remain, more than the 2+2's
    // four, so D17's last squares don't apply either. (Pre-D17 this test used
    // a lone 2-region against a 1+2, which is now the last squares.)
    const b = board(7, 1, [
      'fillable',
      'fillable',
      'fillable',
      'blank',
      'fillable',
      'blank',
      'fillable',
    ]);
    expect(fallbackHasLegalPlacement(b, '2+2')).toBe(false);
  });

  it('is true for a compound face split across two disjoint regions, each exactly the right size', () => {
    const b = board(4, 1, ['fillable', 'fillable', 'blank', 'fillable']);
    expect(fallbackHasLegalPlacement(b, '1+2')).toBe(true);
  });
});
