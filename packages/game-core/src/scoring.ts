import { NotImplementedError } from './not-implemented.js';
import type { Board, PlayerId, RoundResult } from './types.js';

/** Phase 1: score one player's board. */
export function scoreBoard(_playerId: PlayerId, _board: Board): RoundResult['scores'][number] {
  throw new NotImplementedError('scoreBoard');
}

/** Phase 1: rank all players at end of round. */
export function scoreRound(
  _round: number,
  _boards: Readonly<Record<PlayerId, Board>>,
): RoundResult {
  throw new NotImplementedError('scoreRound');
}
