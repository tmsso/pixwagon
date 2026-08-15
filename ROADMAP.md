# ROADMAP.md — Pixwagon build plan

Companion to `CLAUDE.md` (domain rules and conventions — read first), `docs/architecture.md` (the source design document, committed verbatim), `docs/contracts/` (the four seams frozen early) and `IDEAS.md` (loose backlog).

Phases are sequential; each ends with something demoable and a bold **Accept:** line. Do not start a phase before its predecessor is accepted. Suggested cadence: one phase per Claude Code batch.

The ordering follows `docs/architecture.md` §7 and its rationale: **prove the game (1–3) before the infrastructure (4–5)**, and **prove the hardest infrastructure primitive (4) in isolation** before building competitive features on it. Two additions to that list, both explained where they appear: Phase 0 (the sync-ready scaffold, pulled out of §10) and Phase 3.5 (a Cloudflare account gate).

---

## Phase 0 — Repo and sync-ready scaffold ✅ **Accepted 2026-07-31**

Everything `/design-sync` needs to find before any screen is designed, plus the skeleton the later phases fill in.

- pnpm workspace monorepo: `packages/game-core`, `packages/packs`, `packages/protocol`, `apps/web`, `apps/server`.
- `game-core`: full type surface + stubs that throw `NotImplementedError`. One piece of real logic — the **seeded RNG**, because it is the §6 determinism contract and everything reproducible depends on it.
- `packs`: zod schema + the transportation pack as data (three original pictures).
- `protocol`: versioned WebSocket message types, zod-validated inbound.
- `apps/web`: React + Vite + TS + Tailwind v4, five route stubs, thirteen component shells, PWA manifest.
- `apps/server`: Worker router + Room Durable Object, WebSocket hibernation API, presence.
- **Design tokens** as a real module (`apps/web/src/design/tokens.ts`), with `tokens.css` and the `design-system/` preview bundle generated from it and committed.
- CI: format, lint, typecheck, test, build, screen render, generated-file drift, design-card render.

**Accept:** ✅ CI green on GitHub; `pnpm verify` passes locally; the Room DO accepts a WebSocket and answers a join under `wrangler dev --local`; all 17 design-system cards render with visibly distinct variants.

---

## Phase 0.5 — Design interlude _(not a code phase — the admin drives this)_ ✅ **Accepted 2026-08-15**

The scaffold exists so this can happen against real tokens rather than invented ones.

1. Create a project of type **design system** in Claude Design. This type is fixed at creation — a regular Design project cannot be converted into one later, so getting it right here saves a redo.
2. Run `/design-sync` from a session on this repo to upload `design-system/`.
3. Generate the six surfaces in Claude Design (see `docs/design/BRIEF.md`).
4. Annotate on canvas — the brief lists the annotations the architecture already implies.
5. Bring the result back with the **Handoff button**, which opens a fresh Claude Code session preloaded with the design context.

**Accept:** Design generates against our card index rather than approximated colours and invented component names; the output lands in `docs/design/`.

Landed in `docs/design/handoff/` (chat transcripts + sync record) and
`docs/design/surfaces/` (the annotated six-surface canvas), via PR #8. That
PR also shipped the one code change the handoff specified: `DiceFace.tsx`'s
combination faces (`1+2`/`2+2`/`1+3`) now stack their two blobs on separate
lines with a hairline rule instead of a crowded inline row. Building the six
surfaces out as real routes is still Phase 2, not started by that PR.

> Direction note: every `DesignSync` write method points repo → Design. The Design → repo direction is the Handoff button, not a `/design-sync` pull. See `docs/design/README.md`.

---

## Phase 1 — `game-core` + shape-pack rules ✅ **Accepted 2026-08-01**

**Revised 2026-07-31, before any of this was implemented** — the dice/combo
model below is replaced by polyomino placement plus a fallback die. See
`docs/mechanics-correction.md` for the full reasoning and what stays
unimplemented-but-decided; `docs/architecture.md` itself is not edited (§0
convention: corrections live beside it, same as `docs/design/README.md` does
for design-sync). This is a bigger Phase 1 than originally scoped — two
randomizer paths, piece rotation/mirroring, shape-fit legality, two placement
kinds, a redesigned `fill` wire message — budget for that honestly rather than
letting it surface as slippage.

The rules engine, pure and heavily tested. Nothing here touches the network, the filesystem, or a browser global — this is what lets the identical code act as both the client's optimistic predictor and the server's referee.

- Board model: build a `Board` from a pack picture; fillable vs blank cells. (Unchanged.)
- **Shape library**: a fixed set of polyomino pieces, engine-global — not per-pack (packs stay pictures-only, per §2.4/constraint 4). Needs its own frozen-snapshot test, same discipline as `rng.test.ts`: pieces are picked from by index, so the library's order/contents are as load-bearing as the RNG algorithm itself — changing either changes every seeded room and past daily puzzle.
- **Round issuance**: `issueRoll(roomSeed, round)` still derives everything from `deriveSeed(roomSeed, round)` and nothing else (see `docs/contracts/rng.md`) — but a round now issues a **pair offer** (two pieces, take-both-or-decline) and, from the same seed, an independent **fallback offer** (a custom die: `1 / 2 / 3 / 1+2 / 2+2 / 1+3`), both revealed up front — no information gated behind declining, which would leak the fallback value to slower-deciding players in same-board mode.
- **Move legality — two placement kinds, chosen freely each turn**:
  - **Pair**: both pieces placed atomically in one move — each rotated/mirrored/positioned by the player, each fitting entirely over currently-fillable, unfilled cells.
  - **Fallback**: one or two independently-contiguous blobs sized to the die face; a compound face (e.g. `1+2`) is both-blobs-or-neither — no partial placement.
  - Every `MoveRejection` reason exercised — the set changes from the dice-era list (`cell-count-mismatch`/`cells-not-contiguous` collapse into shape/blob-fit checks; add whatever a fixed-shape-at-a-position-and-orientation needs).
- **Scoring, decided here**: a fixed point value per **fully completed** picture, zero for an incomplete one — no partial/percentage credit. Grouping/pattern bonus scoring is explicitly deferred, not v1.
- **Game end, decided 2026-08-01**: a session cycles through its pack's pictures (closer to Pixelino's 38 animals than a single win/lose board), ending on **piece-pool exhaustion**. Engineering note for whoever builds the Phase 4/5 round lifecycle against this: "pool exhaustion" is a **precomputed total round budget** for the session, not a mutable without-replacement draw — the latter would make round _N_'s offer depend on which pieces earlier rounds actually consumed, breaking `deriveSeed(roomSeed, round)`'s "a late joiner computes round 7 directly" guarantee (`docs/contracts/rng.md`). Concretely: the pair offer is _always_ independently derived per round exactly as `issueRoll` already does (pieces can and do repeat across rounds — only a single pair never repeats within itself, per Phase 1 slice 2); the "pool" is a session-level round-count budget computed once (e.g. from the pack's total fillable-cell count), consumed by turns taken, not by which specific pieces were offered. `RoomState.boards` needing to model "current picture, not the whole session" is Phase 4's job (see the note at `RoomState` in `types.ts`), not a Phase 1 code change — Phase 1 only had to make sure the rules layer doesn't foreclose it, and none of `issueRoll`/`applyMove`/`scoreBoard`'s signatures needed to change to accommodate cycling.
- Property-based tests alongside the examples: a legal move must never be rejected, an illegal one never accepted.

**Accept:** a full board can be completed start to finish inside a test (an achievability property of the engine — favorable rolls exist that complete a board; this is not a claim that every live game reaches 100%), with no UI and no server; every `MoveRejection` variant has a test that produces it; the shape library has a passing frozen-snapshot test.

---

## Phase 2 — Local solo playable

`web` + `game-core` + one pack, no network. Proves the game is fun and the board interaction works before any multiplayer complexity exists.

- Canvas board renderer, drawing the states `BoardCell` already defines. Crisp integer scaling, device-pixel-ratio aware.
- **Touch and mouse input for piece placement — corrected 2026-08-15 to match `docs/mechanics-correction.md`, which this bullet predates.** Not "drag to fill contiguous cells" (that was the dice-era model). Per round: rotate/mirror/position each of the pair's two pieces independently, committed as one atomic move (no partial placement); or place one or two independent blobs sized to the fallback die's face, each blob dragged into place, compound faces both-or-nothing. Undo before commit, either path. **Correction, 2026-08-15:** `docs/design/surfaces/` has no annotation specifying the on-board placement gesture — the slot this bullet originally pointed to (annotation 7) was repurposed for the `DiceFace` combo-stacking fix in PR #8 and never carried placement guidance. The affordance is designed in this phase from what the handoff *does* specify: `BoardCell`'s `candidate`/`invalid` states (`docs/design/surfaces/` Annotation 01) and the disabled-not-hidden control pattern (Annotation 04). Concretely: tap a piece in the roll control to select it, tap a board cell to place it as `candidate` cells at a default orientation, rotate/mirror buttons adjust the pending candidate, tapping a different cell moves it, and a commit button (mirroring `RollControl`'s existing "Place N squares" state) submits the whole choice atomically through `applyMove`.
- Real screens replacing the Phase 0 placeholders, built from the design handoff (landed at `docs/design/handoff/` and `docs/design/surfaces/`, PR #8).
- **Client state, decided 2026-08-15: zustand**, not a bare reducer. Reasoning: Phase 4/5 will need a WebSocket handler to dispatch state updates from outside the React tree (a reconnect/resync event has no natural React event to hang a `dispatch` off), and a zustand store's plain `getState()`/`setState()` outside components is a better fit for that than threading a reducer's `dispatch` through a context. The solo store built in this phase (`apps/web/src/state/soloGame.ts`) is the first real use; multiplayer will likely need a second store shaped around `RoomState`, not a reuse of this one.
- Ships as a static page.

**Accept:** a single player completes a transportation picture in a browser on a phone-sized viewport, offline, with no server running.

---

## Phase 3 — PWA shell

- Manifest (already stubbed) + service worker via Workbox.
- Precache the app shell and the shipped pack; solo and daily work with the network off.
- Install prompt handling; verify an actual install on a real phone, not just a Lighthouse score.

**Accept:** installs to a phone home screen and plays solo in aeroplane mode.

---

## Phase 3.5 — Cloudflare account and free-tier gate

New phase, not in `docs/architecture.md` §7. It exists because there was no Cloudflare account when this plan was written, and because the free-tier availability of Durable Objects is the single assumption the whole backend rests on. Verify it on the real account before Phase 4 builds anything on top.

- Create the Cloudflare account; confirm Workers, Pages and Durable Objects are available on the free plan.
- Confirm the **SQLite storage backend** requirement: DOs are free-tier only in SQLite-backed form; key-value-backed DOs still need a paid plan. `apps/server/wrangler.jsonc` already declares `new_sqlite_classes` for this reason — the migration list is append-only, so a wrong first deploy is awkward to unwind.
- Note the daily budget: 100k requests and 13,000 GB-s. Confirm the hibernation behaviour keeps an idle room off the duration meter.
- Deploy the existing Phase 0 worker as-is and connect to it from a real device.

**Accept:** the Phase 0 Room DO is deployed to Cloudflare and a phone on mobile data joins it over a WebSocket.

---

## Phase 4 — Realtime skeleton

The riskiest infrastructure bet, validated in isolation. **No filling yet** — deliberately.

- Flesh out the protocol: join/leave, presence, round lifecycle, roll issuance.
- Room state in the Durable Object: players, mode, seed, round.
- Client WebSocket layer with reconnect and resync-on-reconnect.
- **Move the seat count somewhere both sides can read.** `MAX_SEATS` is defined in `apps/server/src/env.ts` and `playerColors.length` in `apps/web/src/design/tokens.ts`; the server cannot import the latter. Two definitions of "how many players fit" is a bug waiting for the day someone adds a seventh colour.
- **Hibernation-aware from the start**, not as a later optimisation: per-connection state lives in the socket attachment, never in an instance field, because the runtime may evict the object while sockets stay open. Getting this wrong is only visible under real idle traffic, which is the worst time to find it.

**Accept:** two devices join the same room code, see each other's presence, and see the identical seeded roll. Killing one client's network and restoring it resyncs without a page reload.

---

## Phase 5 — Same-board multiplayer

The core competitive loop. Filling goes through the referee.

- Server issues rolls, validates every fill through `game-core`, broadcasts deltas.
- Client shows optimistic fills and reconciles against server truth; rejections roll back visibly (`BoardCell` already has an `invalid` state for this).
- Round lifecycle: roll → fill → score → next.

**Accept:** an illegal fill submitted by a tampered client is rejected by the server and visibly rolls back on the client that attempted it, while other players never see it.

---

## Phase 6 — Own-board mode + results and compare

- Parallel per-player boards from the same roll stream.
- End-of-round comparison and the results screen.
- Rematch keeping the same players with a fresh seed.

**Accept:** two players finish different pictures from the same round-by-round offers (pair + fallback, per `docs/mechanics-correction.md`); the results screen ranks them; rematch starts a new game without anyone rejoining.

---

## Phase 7 — Persistence + daily puzzle

First point at which anything needs storage.

- **Decide here:** per-room SQLite inside the Durable Object versus D1. On the free tier every DO already carries SQLite storage, so D1 may not be needed at all for per-room data — `docs/architecture.md` §4F predates that finding. Write the decision down in this file.
- Daily seed derivation and distribution; the same puzzle for everyone that day.
- Saved results; optional leaderboard.
- Keep it behind the small `store` interface so earlier phases stay independent of it.

**Accept:** the daily puzzle is identical across two devices in different browsers, and a completed result survives a reload.

---

## Phase 8 — Second shape pack

The test of the theme-agnostic constraint (`docs/architecture.md` §2.4), not just more content.

- Ship a non-transportation pack purely as data.

**Accept:** the pack ships with **zero** changes to `game-core`, `apps/web` or `apps/server` — only a new file under `packages/packs/data/`. If anything else had to change, the seam leaked and that is the finding.

---

## Phase 9 — Polish

- Reduced motion (the token layer already collapses durations — verify it end to end).
- Colour-vision verification: simulate protanopia/deuteranopia/tritanopia against real boards, confirm the hatch patterns carry the distinction on their own.
- Small-phone layout, one-handed reach, safe-area insets.
- Keyboard navigation and focus order across all six surfaces.
- Sound hooks, off by default.

**Accept:** a full game is playable one-handed on a small phone, and playable in greyscale — colour is never the sole carrier of any signal.

---

## Non-goals for v1

Accounts and auth, matchmaking beyond room codes, native app-store builds, monetisation, server-persisted history beyond daily seeds and results. The design leaves room for these; v1 does not build them.
