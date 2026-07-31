import { createRng, deriveSeed } from './rng.js';
import { SHAPE_LIBRARY } from './shapes.js';
import { FALLBACK_FACE_IDS } from './types.js';
import type { Roll, Seed } from './types.js';

/**
 * Issues the roll for a round: a no-repeat pair offer and an independent
 * fallback offer, both derived from `deriveSeed(roomSeed, round)` and nothing
 * else (docs/contracts/rng.md). No hidden dependence on how many rounds came
 * before, no dependence on player count — otherwise a late joiner cannot
 * reconstruct the round and the client can no longer verify the server.
 *
 * The pair and fallback each get their own discriminator
 * (`deriveSeed(roomSeed, round, 'pair' | 'fallback')`, pinned here per
 * rng.md's "not yet decided" note) so that revealing one never depends on
 * having drawn the other — both are revealed up front by design.
 */
export function issueRoll(roomSeed: Seed, round: number): Roll {
  const pairRng = createRng(deriveSeed(roomSeed, round, 'pair'));
  const first = pairRng.pick(SHAPE_LIBRARY);
  // Decided 2026-08-01: a pair offer never repeats a piece — draw the second
  // from the library with the first excluded, rather than two independent picks.
  const remaining = SHAPE_LIBRARY.filter((piece) => piece.id !== first.id);
  const second = pairRng.pick(remaining);

  const fallbackRng = createRng(deriveSeed(roomSeed, round, 'fallback'));
  const fallback = fallbackRng.pick(FALLBACK_FACE_IDS);

  return {
    round,
    seed: deriveSeed(roomSeed, round),
    pair: [first.id, second.id],
    fallback,
  };
}
