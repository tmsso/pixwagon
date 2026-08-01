import { isComplete } from './board.js';
import type { Board, PlayerId, PlayerScore, RoundResult } from './types.js';

/**
 * Decided in docs/mechanics-correction.md: a fixed point value per fully
 * completed picture, zero for an incomplete one — no partial/percentage
 * credit. Grouping/pattern bonus scoring is explicitly deferred, not v1.
 */
export const POINTS_PER_COMPLETED_PICTURE = 100;

/** Scores one player's board. */
export function scoreBoard(playerId: PlayerId, board: Board): PlayerScore {
  const total = board.cells.filter((cell) => cell !== 'blank').length;
  const filled = board.cells.filter((cell) => cell === 'filled' || cell === 'locked').length;
  const complete = isComplete(board);

  return {
    playerId,
    filled,
    total,
    // A board with nothing to fill (total === 0) is vacuously complete, same
    // as isComplete() treats it — not 0%, which would contradict awarding
    // full points on the very next line.
    completion: total === 0 ? 1 : filled / total,
    points: complete ? POINTS_PER_COMPLETED_PICTURE : 0,
  };
}

/** Scores every player's board for a round. */
export function scoreRound(round: number, boards: Readonly<Record<PlayerId, Board>>): RoundResult {
  const scores = Object.entries(boards).map(([playerId, board]) => scoreBoard(playerId, board));

  return {
    round,
    scores,
    complete: scores.every((score) => score.points > 0),
  };
}
