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
    const b = board(2, 1, ['fillable', 'blank']);
    expect(fallbackHasLegalPlacement(b, '2')).toBe(false);
  });

  it('is true for a compound face when a region covers each required size', () => {
    const b = board(5, 1, Array(5).fill('fillable'));
    expect(fallbackHasLegalPlacement(b, '1+2')).toBe(true);
  });

  it('is false for a compound face when nothing meets the larger required size', () => {
    const b = board(1, 1, ['fillable']);
    expect(fallbackHasLegalPlacement(b, '1+2')).toBe(false);
  });

  it('is false for a compound face when only one region exists and it is too small for both blobs at once — a component-size-only check gets this wrong', () => {
    // One connected region of exactly 2 cells "individually" clears both the
    // >=1 and >=2 checks a size-only heuristic would run, but 1+2 needs 3
    // disjoint cells total and only 2 exist anywhere on the board. Found via
    // a live seeded playthrough (docs/mechanics-correction.md's fallback
    // rules) before this exact check replaced the earlier approximation.
    const b = board(2, 1, ['fillable', 'fillable']);
    expect(fallbackHasLegalPlacement(b, '1+2')).toBe(false);
  });

  it('is true for a compound face split across two disjoint regions, each exactly the right size', () => {
    const b = board(4, 1, ['fillable', 'fillable', 'blank', 'fillable']);
    expect(fallbackHasLegalPlacement(b, '1+2')).toBe(true);
  });
});
