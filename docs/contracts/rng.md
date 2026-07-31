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
const pairRng = createRng(deriveSeed(roomSeed, 7, 'pair'));
const first = pairRng.pick(shapeLibrary);
const second = pairRng.pick(shapeLibrary.filter((piece) => piece.id !== first.id)); // never repeats
const fallback = createRng(deriveSeed(roomSeed, 7, 'fallback')).pick(fallbackFaces);

// Wrong — requires having drawn rounds 0..6 first.
const pair = [sharedRng.pick(shapeLibrary), sharedRng.pick(shapeLibrary)];
```

(See `docs/mechanics-correction.md` for what a round issues now — a polyomino
pair plus an independent fallback-die value, not a set of dice. Each uses its
own discriminator on the same round seed, per the "derive, don't advance" rule
above, so revealing one never depends on drawing the other.)

Two consequences, both load-bearing:

1. **A late joiner computes the current round directly.** With a single stream they would have to replay every prior round to get in sync, and any gap desyncs them permanently.
2. **Adding a draw early cannot shift later rounds.** Introduce a tiebreak or a shuffle in round 2 with a shared stream and every subsequent round silently changes — including in already-recorded daily puzzles.

## Frozen output

`rng.test.ts` pins the first five values for seed `pixwagon` with an inline snapshot. Changing the algorithm changes every seeded room and every past daily puzzle. That is allowed, but it must be a deliberate, versioned act — the failing snapshot is the tripwire, not an inconvenience to update away.

## Decided in Phase 1 (2026-08-01)

- The discriminator strings are exactly `'pair'` and `'fallback'` —
  `deriveSeed(roomSeed, round, 'pair')` and `deriveSeed(roomSeed, round,
'fallback')`. `roll.ts`'s `issueRoll` and `roll.test.ts` pin this; changing
  either string is the same class of change as changing the shape library's
  order, not a refactor.
- A pair offer never repeats a piece: the pair's second piece is drawn from
  the library with the first excluded, both from the same `'pair'`-derived
  RNG stream (one stream, two draws — not two independent streams that could
  coincide).

## Not yet decided

- Whether `Roll` carries the derived seed or only the round index. Currently it carries both; collapse it in Phase 4 if the redundancy proves useless.
- Room-seed generation. Phase 0 generates room _codes_ (`apps/server/src/env.ts`) but the room seed is not yet distinct from the code. Decide in Phase 4 — a seed that is guessable from the code is fine for a friendly game, less fine for a leaderboard.

## Shape-library snapshot discipline (Phase 1)

`issueRoll` (`packages/game-core/src/roll.ts`) picks pieces from the fixed
shape library (`shapes.ts`) by index (see `docs/mechanics-correction.md`).
That library carries the same frozen-output discipline as this file's RNG
snapshot: `shapes.test.ts` pins its order and contents. The library is
exactly as load-bearing as the algorithm above — reordering or editing it
silently changes every seeded room and every past daily puzzle, the same
failure mode `rng.test.ts` exists to catch for the PRNG itself. Changing it
is allowed; it must be a deliberate, versioned act, not an incidental
refactor.
