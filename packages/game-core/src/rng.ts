/**
 * Seeded RNG — the "seed → roll determinism" contract from architecture.md §6.
 *
 * This is the one piece of real logic in the Phase 0 scaffold, because everything
 * else about a room being reproducible/replayable hangs off it: the server is the
 * referee (§2.3), and the only way a client can verify what the server rolled is
 * for both to run identical arithmetic on an identical seed.
 *
 * See docs/contracts/rng.md for the frozen contract and the derived-seed rule.
 */

/**
 * xmur3 — hashes a string seed into a 32-bit integer stream.
 *
 * Why hash at all: mulberry32 needs a 32-bit integer, but our seeds are strings
 * ("PIXW-7Q2M", "daily-2026-07-30"). Feeding a weakly-varying string in directly
 * would make similar seeds produce similar first rolls, which is exactly what a
 * daily puzzle must not do.
 */
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/**
 * mulberry32 — small, fast, well-distributed 32-bit PRNG.
 *
 * Chosen over `Math.random()` (not seedable) and over a crypto PRNG (not
 * reproducible, and we need reproducibility more than we need unpredictability —
 * fairness here comes from the server owning the seed, not from the algorithm).
 * All arithmetic is integer ops that behave identically in every JS engine, which
 * is what lets the browser and the Durable Object agree.
 */
function mulberry32(a: number): () => number {
  let state = a;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rng {
  /** Next float in [0, 1). */
  next(): number;
  /** Next integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
  /** Next die result in [1, sides]. */
  die(sides: number): number;
  /** Uniform pick from a non-empty list. */
  pick<T>(items: readonly T[]): T;
  /** How many values have been drawn — lets a replay assert it consumed the same amount. */
  readonly drawn: number;
}

export function createRng(seed: string): Rng {
  const next32 = xmur3(seed);
  const next = mulberry32(next32());
  let drawn = 0;

  const rng: Rng = {
    next() {
      drawn += 1;
      return next();
    },
    int(maxExclusive: number) {
      if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
        throw new RangeError(`int() needs a positive integer bound, got ${maxExclusive}`);
      }
      return Math.floor(rng.next() * maxExclusive);
    },
    die(sides: number) {
      return rng.int(sides) + 1;
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new RangeError('pick() called on an empty list');
      // Non-null assertion is sound: index is bounded by the length check above,
      // but `noUncheckedIndexedAccess` cannot see that.
      return items[rng.int(items.length)]!;
    },
    get drawn() {
      return drawn;
    },
  };

  return rng;
}

/**
 * Derives a stable sub-seed from a parent seed plus discriminators.
 *
 * The rule this exists to enforce (see docs/contracts/rng.md): a round's roll is
 * derived from `deriveSeed(roomSeed, roundNumber)`, NOT drawn from one long
 * advancing stream. Two consequences, both load-bearing:
 *
 *  - A player joining at round 7 computes round 7 directly. With a single stream
 *    they would have to replay rounds 1–6 to get in sync.
 *  - Adding a draw anywhere early (a tiebreak, a shuffle) cannot silently shift
 *    every later round's result.
 */
export function deriveSeed(seed: string, ...parts: readonly (string | number)[]): string {
  return [seed, ...parts].join('␟');
}
