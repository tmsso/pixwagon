import { describe, expect, it } from 'vitest';
import {
  BOARD_CELL_STEPS,
  fitCellSize,
  resolveBoardCellSize,
  resultsCellForViewport,
  stepForViewport,
} from './boardScale.ts';

describe('stepForViewport', () => {
  it('is 20 below the tablet breakpoint', () => {
    expect(stepForViewport(320)).toBe(20);
    expect(stepForViewport(390)).toBe(20);
    expect(stepForViewport(767)).toBe(20);
  });

  it('is 28 from 768 up to the desktop breakpoint', () => {
    expect(stepForViewport(768)).toBe(28);
    expect(stepForViewport(1179)).toBe(28);
  });

  it('is 40 from 1180 up', () => {
    expect(stepForViewport(1180)).toBe(40);
    expect(stepForViewport(2560)).toBe(40);
  });

  it('only ever returns one of the three integer steps', () => {
    for (let w = 200; w <= 3000; w += 37) {
      expect(BOARD_CELL_STEPS).toContain(stepForViewport(w));
    }
  });
});

describe('resolveBoardCellSize', () => {
  it('uses the viewport step when the board fits', () => {
    // 15 cols * 40 = 600 <= 1200 available
    expect(resolveBoardCellSize(1400, 15, 1200)).toBe(40);
  });

  it('drops a step rather than fitting to width when the board would overflow', () => {
    // desktop step 40: 15*40 = 600 > 500 → drop to 28: 15*28 = 420 <= 500
    expect(resolveBoardCellSize(1400, 15, 500)).toBe(28);
  });

  it('drops more than one step if it has to, but never below 20', () => {
    // 15*40=600, 15*28=420, both > 300 → 20 (even though 15*20=300 fits exactly)
    expect(resolveBoardCellSize(1400, 15, 300)).toBe(20);
    // nothing fits: still clamped at the 20 floor, board just gets more margin
    expect(resolveBoardCellSize(1400, 40, 100)).toBe(20);
  });

  it('never returns a fractional size', () => {
    for (let cols = 8; cols <= 40; cols += 1) {
      const size = resolveBoardCellSize(900, cols, 360);
      expect(Number.isInteger(size)).toBe(true);
      expect(BOARD_CELL_STEPS).toContain(size);
    }
  });
});

describe('resultsCellForViewport', () => {
  it('steps 5, 8, 12 at the board rule breakpoints and nowhere between', () => {
    expect(resultsCellForViewport(390)).toBe(5);
    expect(resultsCellForViewport(767)).toBe(5);
    expect(resultsCellForViewport(768)).toBe(8);
    expect(resultsCellForViewport(1179)).toBe(8);
    expect(resultsCellForViewport(1180)).toBe(12);
  });
});

describe('fitCellSize (pass 04)', () => {
  it('is the largest whole pixel size that fits both dimensions', () => {
    // A 12×8 board in a 1000×600 area: width allows 83, height 75.
    expect(fitCellSize(12, 8, 1000, 600)).toBe(64);
    expect(fitCellSize(12, 8, 700, 400)).toBe(50);
    expect(fitCellSize(12, 8, 358, 400)).toBe(29);
  });

  it('clamps to 16–64 and never returns a fraction', () => {
    expect(fitCellSize(12, 8, 100, 100)).toBe(16);
    expect(fitCellSize(3, 3, 5000, 5000)).toBe(64);
    for (let w = 150; w < 1600; w += 53) {
      expect(Number.isInteger(fitCellSize(11, 9, w, w * 0.7))).toBe(true);
    }
  });
});
