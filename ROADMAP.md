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

## Phase 0.5 — Design interlude _(not a code phase — Tamas drives this)_

The scaffold exists so this can happen against real tokens rather than invented ones.

1. Create a project of type **design system** in Claude Design. This type is fixed at creation — a regular Design project cannot be converted into one later, so getting it right here saves a redo.
2. Run `/design-sync` from a session on this repo to upload `design-system/`.
3. Generate the six surfaces in Claude Design (see `docs/design/BRIEF.md`).
4. Annotate on canvas — the brief lists the annotations the architecture already implies.
5. Bring the result back with the **Handoff button**, which opens a fresh Claude Code session preloaded with the design context.

**Accept:** Design generates against our card index rather than approximated colours and invented component names; the output lands in `docs/design/`.

> Direction note: every `DesignSync` write method points repo → Design. The Design → repo direction is the Handoff button, not a `/design-sync` pull. See `docs/design/README.md`.

---

## Phase 1 — `game-core` + shape-pack rules

The rules engine, pure and heavily tested. Nothing here touches the network, the filesystem, or a browser global — this is what lets the identical code act as both the client's optimistic predictor and the server's referee.

- Board model: build a `Board` from a pack picture; fillable vs blank cells.
- Roll issuance: `issueRoll(roomSeed, round)` deriving from `deriveSeed(roomSeed, round)` and nothing else (see `docs/contracts/rng.md` for why a per-round derived seed rather than one advancing stream).
- Combo derivation: what options a set of dice permits.
- Move legality: bounds, already-filled, contiguity, colour, round, cell count — every `MoveRejection` reason exercised.
- Completion detection and scoring.
- Property-based tests alongside the examples: a legal move must never be rejected, an illegal one never accepted.

**Accept:** a full board can be completed start to finish inside a test, with no UI and no server; every `MoveRejection` variant has a test that produces it.

---

## Phase 2 — Local solo playable

`web` + `game-core` + one pack, no network. Proves the game is fun and the board interaction works before any multiplayer complexity exists.

- Canvas board renderer, drawing the states `BoardCell` already defines. Crisp integer scaling, device-pixel-ratio aware.
- Touch and mouse input; drag to fill multiple cells; undo before commit.
- Real screens replacing the Phase 0 placeholders, built from the design handoff.
- Client state: pick a store (zustand or a reducer) — decide in this phase and record the choice here.
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

**Accept:** two players finish different pictures from the same dice; the results screen ranks them; rematch starts a new game without anyone rejoining.

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
