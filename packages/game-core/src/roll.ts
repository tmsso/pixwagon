import { NotImplementedError } from './not-implemented.js';
import type { Roll, Seed } from './types.js';

/**
 * Phase 1: issue the roll for a round.
 *
 * Contract note carried over from docs/contracts/rng.md: this must derive its
 * randomness from `deriveSeed(roomSeed, round)` and nothing else. No hidden
 * dependence on how many rounds came before, no dependence on player count —
 * otherwise a late joiner cannot reconstruct the round and the client can no
 * longer verify the server.
 */
export function issueRoll(_roomSeed: Seed, _round: number): Roll {
  throw new NotImplementedError('issueRoll');
}

/** Phase 1: derive the legal combo options a set of dice permits. */
export function comboOptionsFor(_roll: Pick<Roll, 'dice'>): Roll['combo'] {
  throw new NotImplementedError('comboOptionsFor');
}
