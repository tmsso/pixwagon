import { describe, expect, it } from 'vitest';
import { POINTS_PER_COMPLETED_PICTURE, scoreBoard, scoreRound } from './scoring.js';
import type { Board, CellState } from './types.js';

function board(cells: readonly CellState[]): Board {
  const width = cells.length;
  return { size: { width, height: 1 }, packId: 'test', pictureId: 'test', cells };
}

describe('scoreBoard', () => {
  it('scores zero points for an incomplete board, however close', () => {
    const score = scoreBoard('p1', board(['filled', 'filled', 'fillable', 'blank']));
    expect(score).toEqual({
      playerId: 'p1',
      filled: 2,
      total: 3,
      completion: 2 / 3,
      points: 0,
    });
  });

  it('scores the fixed point value for a fully completed picture', () => {
    const score = scoreBoard('p1', board(['filled', 'locked', 'blank']));
    expect(score.points).toBe(POINTS_PER_COMPLETED_PICTURE);
    expect(score.completion).toBe(1);
  });

  it('gives no partial credit — 99% complete scores the same as 0%', () => {
    const almost = scoreBoard('p1', board(['filled', 'filled', 'filled', 'fillable']));
    const none = scoreBoard('p1', board(['fillable', 'fillable', 'fillable', 'fillable']));
    expect(almost.points).toBe(none.points);
    expect(almost.points).toBe(0);
  });

  it('treats an all-blank board (nothing to fill) as complete', () => {
    const score = scoreBoard('p1', board(['blank', 'blank']));
    expect(score.completion).toBe(1);
    expect(score.points).toBe(POINTS_PER_COMPLETED_PICTURE);
  });
});

describe('scoreRound', () => {
  it('scores every player independently and reports round completion', () => {
    const result = scoreRound(3, {
      p1: board(['filled', 'filled']),
      p2: board(['filled', 'fillable']),
    });

    expect(result.round).toBe(3);
    expect(result.scores).toHaveLength(2);
    expect(result.scores.find((s) => s.playerId === 'p1')?.points).toBe(
      POINTS_PER_COMPLETED_PICTURE,
    );
    expect(result.scores.find((s) => s.playerId === 'p2')?.points).toBe(0);
    expect(result.complete).toBe(false);
  });

  it('is complete once every player has completed their board', () => {
    const result = scoreRound(1, {
      p1: board(['filled', 'filled']),
      p2: board(['locked', 'blank']),
    });
    expect(result.complete).toBe(true);
  });
});
