import { describe, expect, it } from 'vitest';
import { fallbackFaceView, pieceOfferView } from './offerView.ts';

describe('pieceOfferView', () => {
  it('renders the domino at its canonical orientation', () => {
    expect(pieceOfferView('domino')).toEqual({
      id: 'domino',
      cells: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    });
  });

  it('normalizes an L-shaped piece to start at (0, 0)', () => {
    const view = pieceOfferView('tromino-l');
    expect(view.id).toBe('tromino-l');
    expect(Math.min(...view.cells.map((c) => c.x))).toBe(0);
    expect(Math.min(...view.cells.map((c) => c.y))).toBe(0);
  });
});

describe('fallbackFaceView', () => {
  it('maps a bare face to a single number', () => {
    expect(fallbackFaceView('2')).toBe(2);
  });

  it('maps a compound face to a two-tuple in size order', () => {
    expect(fallbackFaceView('1+2')).toEqual([1, 2]);
    expect(fallbackFaceView('2+2')).toEqual([2, 2]);
  });
});
