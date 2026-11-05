import { describe, expect, it } from 'vitest';
import { createBoard } from '@pixwagon/game-core';
import { luma, pictureFillColors } from './pictureColors.ts';

describe('pictureFillColors', () => {
  it('gives a colour to exactly the picture squares, row-major', () => {
    const board = createBoard('transportation', 'tram');
    const colors = pictureFillColors('transportation', 'tram')!;
    expect(colors).toHaveLength(board.cells.length);
    board.cells.forEach((cell, i) => {
      expect(colors[i] === null).toBe(cell === 'blank');
    });
  });

  it('knows light from dark', () => {
    expect(luma('#ffffff')).toBeGreaterThan(200);
    expect(luma('#d64a3f')).toBeLessThan(200);
  });
});
