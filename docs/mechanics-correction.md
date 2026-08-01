# Mechanics correction: pieces + fallback die, not dice/combo

`docs/architecture.md` is committed verbatim as the source design document and
is deliberately not edited to reflect this — same pattern `docs/design/README.md`
already established for design-sync behavior. This file is the correction.
`ROADMAP.md` Phase 1 carries the implementation-facing version of this decision.

## What changed, and why

Phase 0.5 design-sync paused when the uploaded design bundle turned out to
contain `DiceFace`/`RollControl` cards for a mechanic — "roll dice, derive a
combo that lets you fill N contiguous cells" — that didn't match what the
game was actually meant to be: a polyomino-placement pixel-fill game, closer
to the Hungarian board game **Pixelino** (Pagony). Researching Pixelino's
actual mechanic (shared rotatable/mirrorable shape pieces, drawn onto an
animal outline, most-completed-cards wins, no dice anywhere) surfaced the gap
before any surfaces were generated against the stale bundle.

## The corrected mechanic

Replaces every "dice/combo" mention in `docs/architecture.md` §1, §2.3, §3,
§4A, §6:

- **Each round**, the referee issues, from that round's derived seed:
  - a **pair offer** — two polyomino pieces from a fixed shape library, placed
    together or not at all (atomic: one move, both placements; rotation and
    mirroring are the player's choice at placement time, not fixed by the
    offer);
  - a **fallback offer** — a value from a custom six-sided die
    (`1 / 2 / 3 / 1+2 / 2+2 / 1+3`). A bare number is one contiguous blob of
    that many cells. A compound value (e.g. `1+2`) is **two independent**
    contiguous blobs, placed anywhere among the player's remaining fillable
    cells — they don't need to touch each other or the pair.
  - Both offers are **revealed up front**, not gated behind declining the
    pair — declining-to-reveal would leak the fallback value to everyone
    still deciding in same-board mode, purely as a function of reaction
    speed.
- **The player freely chooses, every turn**: take the pair, or take the
  fallback. This is a standing strategic decision each round, not an
  error-recovery path for when the pair happens not to fit — closer to
  Pixelino's own "take a lot or a little" tension.
- **Compound fallback faces are both-or-nothing.** A player cannot place only
  one blob of a compound value. Consequence: a board can permanently strand a
  few scattered cells that nothing ever fits — full completion of a given
  board is not guaranteed in every live game (see Scoring, below).
- **Scoring**: a fixed point value per **fully completed** picture, zero for
  an incomplete one. No partial/percentage credit. Grouping/pattern bonus
  scoring (closer to Pixelino's own habitat/trophy variants) is explicitly
  deferred — a later phase, not v1.
- **Game end, decided 2026-08-01** (see `ROADMAP.md` Phase 1 for the full
  reasoning): a session cycles through its pack's pictures, ending on
  piece-pool exhaustion — engineered as a precomputed session round budget,
  not a stateful without-replacement draw, so it stays compatible with
  `deriveSeed(roomSeed, round)`'s late-joiner guarantee (`docs/contracts/rng.md`).
  Needed because "board reaches 100%, then next board" no longer holds as the
  only way a board's turn ends.

## What survives unchanged

- `deriveSeed`, `createRng`, the derive-don't-advance rule, the frozen seed
  snapshot test (`rng.test.ts`). Only the _artifact_ a round's derived seed
  produces changes — a piece pair + a die value, not dice values.
- `areContiguous` — the fallback blobs need exactly this.
- Server-is-the-referee, client-submits-intent, seeded determinism for late
  joiners and daily puzzles — none of this moves.

## What needed rewriting (Phase 1 work — done 2026-08-01, across 3 PRs)

Kept as a historical record of the scope this correction identified before any
of it was built; every item below landed except the design-system/component
rework, which is deliberately deferred to Phase 2 (see `ROADMAP.md` Phase 1's
non-goal note — regenerating `design-system/**` mid-design-pass would churn
what Tamas is reviewing in Claude Design).

- `packages/game-core/src/types.ts` — `Die`, `Roll.dice`, `ComboOption.cells`
  describe the old model and must be replaced.
- `packages/game-core/src/roll.ts`, `moves.ts` — `issueRoll`, `applyMove`,
  `legalCellsFor` all needed the new shapes; `comboOptionsFor` had no
  pair+fallback equivalent and was removed outright rather than reshaped —
  the offer _is_ the roll now, nothing further to derive without the board.
  `legalCellsFor`'s **return type** changed as flagged: `(board, pieceId) =>
readonly { orientation, origin }[]`, not the old `Board['cells']`.
- `packages/protocol/src/index.ts:58-63` — the `fill` client message
  (`comboId` + `cells`, capped at 16) describes the old model. It needs a
  `choice: { kind: 'pair' | 'fallback', placements: [...] }`-shaped
  replacement; atomic pair placement means one wire message carries both
  piece placements. `docs/contracts/ws-protocol.md` carries a pointer to this.
- `docs/contracts/rng.md` — updated in this same pass (see that file).
- `apps/web/src/components/game/DiceFace.tsx` — survives in modified form:
  still a die, just six custom faces instead of pips.
- `apps/web/src/components/game/RollControl.tsx` — needs real rework: it
  presents two known options (pair vs. fallback) each round, not one roll
  result.
- The two design-system cards for the above regenerate via `pnpm design:build`
  once the components change, and the Claude Design project should be
  re-synced once they do.
- **New**: a frozen-snapshot test for the shape library itself (piece order
  and contents) — the library is picked from by index, so changing it
  silently changes every seeded room and past daily puzzle, exactly the
  failure mode `rng.test.ts`'s pinned snapshot exists to catch.

## Originality note

Game mechanics generally aren't copyrightable, and `CLAUDE.md` §7's
originality rule targets art, shape data, palettes, copy, rulebook text, and
trademark naming — not "fill pictures with rotatable polyominoes" as a
concept. What actually needs to stay original: Pixelino's specific 38
animals, its habitat/trophy structure, its name, and its distinctive two-part
(top-two-elements / bottom-one-element) card split — a real design signature,
not a generic mechanic, and not one pixwagon needs. Pixwagon's genuine point
of difference is the real-time seeded-multiplayer architecture, which a
physical board game has no analogue for at all.
