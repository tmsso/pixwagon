import { describe, expect, it } from 'vitest';
import { createRng, deriveSeed } from './rng.js';

const take = (seed: string, n: number): number[] => {
  const rng = createRng(seed);
  return Array.from({ length: n }, () => rng.next());
};

describe('createRng', () => {
  it('produces identical sequences for identical seeds', () => {
    expect(take('PIXW-7Q2M', 32)).toEqual(take('PIXW-7Q2M', 32));
  });

  it('produces different sequences for seeds differing by one character', () => {
    expect(take('PIXW-7Q2M', 8)).not.toEqual(take('PIXW-7Q2N', 8));
  });

  it('stays in [0, 1)', () => {
    const rng = createRng('bounds');
    for (let i = 0; i < 10_000; i += 1) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('rolls dice across the full face range', () => {
    const rng = createRng('dice');
    const seen = new Set<number>();
    for (let i = 0; i < 5_000; i += 1) seen.add(rng.die(6));
    expect([...seen].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('counts draws so a replay can assert it consumed the same amount', () => {
    const rng = createRng('drawn');
    expect(rng.drawn).toBe(0);
    rng.die(6);
    rng.pick(['a', 'b']);
    expect(rng.drawn).toBe(2);
  });

  it('rejects invalid bounds and empty picks', () => {
    const rng = createRng('guards');
    expect(() => rng.int(0)).toThrow(RangeError);
    expect(() => rng.int(2.5)).toThrow(RangeError);
    expect(() => rng.pick([])).toThrow(RangeError);
  });

  /**
   * Locks the exact output. If a refactor changes these numbers it has changed
   * every seeded room and every past daily puzzle — which must be a deliberate,
   * versioned act, not an accident. See docs/contracts/rng.md.
   */
  it('matches the frozen reference sequence for seed "pixwagon"', () => {
    expect(take('pixwagon', 5).map((n) => n.toFixed(10))).toMatchInlineSnapshot(`
      [
        "0.1641478885",
        "0.3667711224",
        "0.7049261986",
        "0.5780846684",
        "0.2716843006",
      ]
    `);
  });
});

describe('deriveSeed', () => {
  it('is stable and order-sensitive', () => {
    expect(deriveSeed('room', 1)).toBe(deriveSeed('room', 1));
    expect(deriveSeed('room', 1, 2)).not.toBe(deriveSeed('room', 2, 1));
  });

  it('lets a late joiner compute round 7 without replaying rounds 1-6', () => {
    const roomSeed = 'PIXW-7Q2M';

    // A client that played every round from the start.
    const fromTheStart = Array.from({ length: 7 }, (_, round) =>
      createRng(deriveSeed(roomSeed, round)).die(6),
    );

    // A client that joined at round 6 (0-indexed) knowing only the room seed.
    const lateJoiner = createRng(deriveSeed(roomSeed, 6)).die(6);

    expect(lateJoiner).toBe(fromTheStart[6]);
  });

  it('gives unrelated first rolls for adjacent rounds', () => {
    const firsts = Array.from({ length: 8 }, (_, round) =>
      createRng(deriveSeed('seed', round)).next(),
    );
    // Adjacent derived seeds must not collide; a single advancing stream would
    // make this trivially true, derived seeds have to earn it via the hash.
    expect(new Set(firsts).size).toBe(firsts.length);
  });
});
