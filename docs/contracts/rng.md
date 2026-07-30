# Contract: seed → roll determinism

**Implemented by** `packages/game-core/src/rng.ts` · **Locked by** `rng.test.ts`

One of the four seams `docs/architecture.md` §6 says to freeze before building features.

## Why this exists

The server is the referee (§2.3), but the client also runs the rules — for instant optimistic UI and for offline solo. Both sides must agree on what was rolled, from nothing but a seed. If they can diverge, the client either shows the wrong dice or has to wait for a round trip before showing anything.

## The algorithm

`xmur3` hashes the string seed to a 32-bit integer, which seeds `mulberry32`.

- **Hashing first is not optional.** mulberry32 needs an integer, and feeding weakly-varying strings in directly makes similar seeds produce similar first outputs — exactly what a daily puzzle (`daily-2026-07-30`, `daily-2026-07-31`) must not do.
- **Not `Math.random()`**: not seedable. **Not a crypto PRNG**: not reproducible. Fairness here comes from the server owning the seed, not from the algorithm being unpredictable.
- All arithmetic is 32-bit integer ops (`Math.imul`, shifts) that behave identically across JS engines. That is what lets a browser and a Durable Object agree.

## The rule that matters most: derive, don't advance

A round's roll **must** come from `deriveSeed(roomSeed, round)`, not from one long stream advanced round by round.

```ts
// Right — round 7 is computable directly.
const roll = createRng(deriveSeed(roomSeed, 7)).die(6);

// Wrong — requires having drawn rounds 0..6 first.
const roll = sharedRng.die(6);
```

Two consequences, both load-bearing:

1. **A late joiner computes the current round directly.** With a single stream they would have to replay every prior round to get in sync, and any gap desyncs them permanently.
2. **Adding a draw early cannot shift later rounds.** Introduce a tiebreak or a shuffle in round 2 with a shared stream and every subsequent round silently changes — including in already-recorded daily puzzles.

## Frozen output

`rng.test.ts` pins the first five values for seed `pixwagon` with an inline snapshot. Changing the algorithm changes every seeded room and every past daily puzzle. That is allowed, but it must be a deliberate, versioned act — the failing snapshot is the tripwire, not an inconvenience to update away.

## Not yet decided

- Whether `Roll` carries the derived seed or only the round index. Currently it carries both; collapse it in Phase 4 if the redundancy proves useless.
- Room-seed generation. Phase 0 generates room _codes_ (`apps/server/src/env.ts`) but the room seed is not yet distinct from the code. Decide in Phase 4 — a seed that is guessable from the code is fine for a friendly game, less fine for a leaderboard.
