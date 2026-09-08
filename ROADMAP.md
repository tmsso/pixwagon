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

## Phase 2 — Local solo playable ✅ **Accepted 2026-08-16**

`web` + `game-core` + one pack, no network. Proves the game is fun and the board interaction works before any multiplayer complexity exists.

- Canvas board renderer, drawing the states `BoardCell` already defines. Crisp integer scaling, device-pixel-ratio aware.
- **Touch and mouse input for piece placement — corrected 2026-08-15 to match `docs/mechanics-correction.md`, which this bullet predates.** Not "drag to fill contiguous cells" (that was the dice-era model). Per round: rotate/mirror/position each of the pair's two pieces independently, committed as one atomic move (no partial placement); or place one or two independent blobs sized to the fallback die's face, each blob dragged into place, compound faces both-or-nothing. Undo before commit, either path. **Correction, 2026-08-15:** `docs/design/surfaces/` has no annotation specifying the on-board placement gesture — the slot this bullet originally pointed to (annotation 7) was repurposed for the `DiceFace` combo-stacking fix in PR #8 and never carried placement guidance. The affordance is designed in this phase from what the handoff _does_ specify: `BoardCell`'s `candidate`/`invalid` states (`docs/design/surfaces/` Annotation 01) and the disabled-not-hidden control pattern (Annotation 04). Concretely: tap a piece in the roll control to select it, tap a board cell to place it as `candidate` cells at a default orientation, rotate/mirror buttons adjust the pending candidate, tapping a different cell moves it, and a commit button (mirroring `RollControl`'s existing "Place N squares" state) submits the whole choice atomically through `applyMove`. **Correction, 2026-09-04:** the gap this note filled by inference is no longer a gap — `docs/design/handoff-02/` Annotation 09 now specifies the on-board placement gesture directly ("finally specified, not inferred", per `BRIEF-02.md`), and it differs from what shipped here: a sheet-based `PlacementEditor` (fixed 284px height, Turn/Flip/Take back as labelled tools, strong/weak ghost states) rather than roll-control selection plus default-orientation tap-placement. Per this repo's own rule (`docs/design/README.md`'s corrections-live-beside-it convention), the later, more specific source wins — this shipped affordance is not yet updated to match. **Decided 2026-09-06:** this rework — the `PlacementEditor` sheet, plus the 3-step board-scale rule from Annotation 11 — is its own dedicated session, scheduled after Phase 3 (PWA shell) and before Phase 4. Not folded into Phase 3, and not given its own numbered phase. Two prerequisites for that session, from `docs/design/handoff-02/README.md`'s "What was NOT implemented": add a `placement-editor` card to `scripts/design-system/cards.tsx` and re-sync (`pnpm design:build` → `pnpm design:check` → `/design-sync`) so the next design pass has something to bind to, and resolve `docs/design/BRIEF.md` still describing the dice/combo mechanic with no superseded banner pointing at `BRIEF-02.md`.

  **Delivered 2026-09-06** (PRs #14 + #15), run **ahead of Phase 3** — Phase 3.5/3 are blocked on a Cloudflare account only the project owner can create (`wrangler` unauthenticated), so this corrective session went first; that also means Phase 3 now binds to the corrected solo UI. Shipped: `PlacementEditor` as `HudFrame`'s 284px `sheet` slot (grip + `pointer-events-none` scrim, chosen-offer bar with Switch, Turn/Flip/Take-back outline-icon tools, in-sheet commit); `boardScale.ts` three-step `cellSize` 20→28→40 (Annotation 11); strong/weak ghost split; offer copy scrubbed to "the pair"/"the single" (Annotation 10); `BRIEF.md` superseded banner; new `placement-editor` design-system card. Store action surface unchanged → the `achievability-0` seed-replay test passed untouched; verified in real Chromium at 390×844 to full picture completion with the size/position invariants holding, zero console errors. #14 also fixed CI (red on `main` since 2026-09-04 — the pass-02 handoff files failed prettier/eslint with no ignore entries). The `/design-sync` re-upload of the new card is **done** (2026-09-06, project `d90f606f`, now 15 component cards) — `docs/design/handoff-02/README.md`'s prerequisite list is fully cleared.

- Real screens replacing the Phase 0 placeholders, built from the design handoff (landed at `docs/design/handoff/` and `docs/design/surfaces/`, PR #8). **Scoped 2026-08-16:** Home, Game, and PackPicker are the three the Phase 0 scaffold's own `ScaffoldNotice` tags "Phase 2" — those are real. Lobby stays a placeholder (tagged "Phase 4"; it needs a room to actually join, which doesn't exist until then). Results was tagged "Phase 6" by that same Phase 0 guess, but the design handoff's own Surface 05 is explicitly captioned "solo completion" — a later, more specific source than a pre-design placeholder — so it's built for real here too; Phase 6 still owns the multiplayer ranked-comparison version of the same route.
- **Client state, decided 2026-08-15: zustand**, not a bare reducer. Reasoning: Phase 4/5 will need a WebSocket handler to dispatch state updates from outside the React tree (a reconnect/resync event has no natural React event to hang a `dispatch` off), and a zustand store's plain `getState()`/`setState()` outside components is a better fit for that than threading a reducer's `dispatch` through a context. The solo store built in this phase (`apps/web/src/state/soloGame.ts`) is the first real use; multiplayer will likely need a second store shaped around `RoomState`, not a reuse of this one.
- Ships as a static page.

**Accept:** ✅ a single player completes a transportation picture in a browser on a phone-sized viewport, offline, with no server running. Verified live 2026-08-16 in two passes: (1) against `achievability-0` (the Phase 1 witness seed), 50 rounds played through real pointer clicks in real Chromium at a 390×844 viewport — Home → Solo → full completion → Results → Rematch — zero console errors; (2) against the actual `pnpm --filter @pixwagon/web build` output served as static files (not the Vite dev server, which the first pass used and which gives HMR/SPA-fallback conveniences the "ships as a static page" bullet doesn't get for free) — loaded, played a move, then went genuinely offline (`context.setOffline(true)`) mid-session and confirmed play continues with zero console errors, proving no runtime fetch dependency. Delivered across 3 PRs (#10 store + board render, #11 placement + round loop, #12 real screens); see the project memory entry for gotchas found along the way (a round-indexing bug, a fallback-legality false positive, and the finding below).

---

## Phase 3 — PWA shell

**Sequencing, decided 2026-09-06: run Phase 3.5 first, despite the file order.** This phase's own Accept line needs a real-phone install, which needs a service worker on a secure origin — Phase 3.5 is what actually stands up that origin (Cloudflare Pages), and it also owns the deep-link-rewrite fix below. Numbering is left as-is (renumbering would ripple into the "ROADMAP Phase 4 already flags this" style cross-references elsewhere in this doc); read this note as the actual execution order, not the heading order.

Design source: `docs/design/handoff-02/` Part B (surfaces `08a`/`08b` install prompt, `09a`/`09b` offline Home and offline solo, `10` update-available banner, `11` splash/first-paint) — landed 2026-09-04, authoritative for this phase.

- Manifest (already stubbed) + service worker via Workbox.
- Precache the app shell and the shipped pack; solo and daily work with the network off.
- Install prompt handling (`08a`/`08b`): appears only after a completed picture, never on first load; "Not now" suppresses 30 days, a second dismissal retires it permanently (ghost button stays on Home). Needs real local persistence for the suppress/retire state, not just component state — `installPromptState` (`eligible | suppressed-until | retired`) per the handoff's state-management notes.
- Update-available banner (`10`): a banner, never a dialog, and it must defer showing until the results screen if a round is in progress — do not interrupt an in-progress placement.
- Offline Home state (`09a`): one neutral `surface-sunken` "Offline" pill, one line naming only what's unavailable (playing with friends) — no red, no modal, no blocking. Offline solo (`09b`) is visually identical to online solo.
- Splash (`11`): cached shell (mark, wordmark), determinate progress bar only if boot exceeds 400ms.
- Verify an actual install on a real phone, not just a Lighthouse score.

**Progress 2026-09-09:** PWA shell shipped. **Service worker** via `vite-plugin-pwa` 1.3.0 (the Workbox integration for Vite) in `generateSW` mode, `registerType: 'prompt'` — a new worker installs and waits so the update banner can defer past a live round. Precache manifest covers the whole offline shell (`index.html`, the CSS and JS chunks, `manifest.webmanifest`, all icons); the shipped pack is a static JSON import already inside the JS chunk, so globbing the build output satisfies "precache the shipped pack" with nothing extra. `navigateFallback: /index.html` (with `/api/*` denylisted) mirrors the Pages `_redirects` rule for offline deep links. `apps/web/public/_headers` serves `sw.js` `no-cache`. **Install prompt** is a pure, unit-tested state machine (`apps/web/src/pwa/installState.ts`): `ineligible` until a picture is finished → `eligible`; "Not now" → 30-day `suppressed`; a second dismissal → `retired` (ghost button stays). Persisted in `localStorage`. Hidden entirely when no `beforeinstallprompt` fired (iOS Safari — the manual Share-sheet install has no event to hook; noted as a small follow-up). **Update banner** (surface 10) gates itself off `/r/:code` while `status === 'playing'`. **Offline** (Annotation 16): one `Offline` pill + one line on Home, "Play with friends" disabled, nothing else changes. **Splash** (surface 11) is inline in `index.html`, `--bg` background, bar revealed only after 400ms, static "Loading…" label + no fade under `prefers-reduced-motion`; `main.tsx` removes it on first paint. **Icons**: `scripts/build-icons.mjs` — a from-scratch PNG encoder (`node:zlib`; the mark is solid-colour rectangles) produces 192/512 PNGs for the manifest and `apple-touch-icon`, avoiding a native rasteriser dependency. Committed as assets, not wired into `generated:check` (`deflateSync` bytes can vary across zlib builds). New `usePwaStore`, separate from `soloGame`. New dep in the catalog: `vite-plugin-pwa`. `design-system/**` regenerated (§5 — new utility classes in the embedded Tailwind sheet). **Verified live** on `https://pixwagon.pages.dev`: `sw.js` → `application/javascript` + `Cache-Control: no-cache`; the precache manifest lists every shell asset; deep links still SPA-fall-back; icons/manifest resolve. **Not verified (no browser tooling this session, handed to the user):** SW actually registering and controlling the page, an offline hard-reload of `/r/solo` booting and playing in aeroplane mode, and the real-phone install below.

**Accept:** installs to a phone home screen and plays solo in aeroplane mode.

---

## Phase 3.5 — Cloudflare account and free-tier gate

New phase, not in `docs/architecture.md` §7. It exists because there was no Cloudflare account when this plan was written, and because the free-tier availability of Durable Objects is the single assumption the whole backend rests on. Verify it on the real account before Phase 4 builds anything on top. **Also, decided 2026-09-06: do this phase before Phase 3** — Phase 3's real-phone install verification needs the secure origin this phase stands up (see the note at the top of Phase 3).

- Create the Cloudflare account; confirm Workers, Pages and Durable Objects are available on the free plan.
- Confirm the **SQLite storage backend** requirement: DOs are free-tier only in SQLite-backed form; key-value-backed DOs still need a paid plan. `apps/server/wrangler.jsonc` already declares `new_sqlite_classes` for this reason — the migration list is append-only, so a wrong first deploy is awkward to unwind.
- Note the daily budget: 100k requests and 13,000 GB-s. Confirm the hibernation behaviour keeps an idle room off the duration meter.
- Deploy the existing Phase 0 worker as-is and connect to it from a real device.
- **Carried from Phase 2's static-build verification (2026-08-16):** a direct load of a client-side route (e.g. `/r/solo`, `/results`) 404s under a plain static file server — `BrowserRouter` deep links need a host-level rewrite to `index.html` that nothing in the repo declares yet. Not a Phase 2 bug (Pages config is this phase's job); this phase needs to add that rewrite (Cloudflare Pages' `_redirects` or equivalent) and confirm a deep link actually loads, not just the app's own internal navigation.

**Progress 2026-09-06:** Cloudflare account created (free plan, no card). `workers.dev` subdomain set to `tmsso` (the account's auto-generated one carried the owner's name — a public-repo leak; renamed once, in-dashboard). Worker renamed `pixwagon` → **`pixwagon-app`** in `wrangler.jsonc` (so the public URL reads `pixwagon-app.tmsso.workers.dev`, not `pixwagon.<name>.workers.dev`). **Deployed** (`wrangler deploy`, version `dd197554`): migration `v1` applied — the `Room` DO exists with the **SQLite** backend (a `new_classes` decl would have failed on free, confirming the requirement). Verified against the live URL: `GET /health` → `{ok,protocolVersion:1}`, `GET /api/config` → `{maxPlayers:6}`, `POST /api/room` → a code, unknown paths 404, bad codes 400; and a **real WebSocket join** — `join` → `welcome` (code round-trips via `X-Room-Code`) + `presence` broadcast, `ping` → `pong`. Deep-link rewrite added as `apps/web/public/_redirects` (`/* /index.html 200`) — **not yet deployed to Pages or confirmed live** (needs the web-app Pages deploy). Hibernation "idle room costs nothing" is a design property of `acceptWebSocket` (used), not measured in this pass. **Still needed for Accept:** a phone on mobile data joining the room, and the Pages deploy + deep-link confirmation.

**Progress 2026-09-09:** web app **deployed to Cloudflare Pages**. Project `pixwagon` created (free plan, `--production-branch=main`); bare name → public URL **`https://pixwagon.pages.dev`** with no account-name segment. `apps/web/wrangler.jsonc` added (`pages_build_output_dir: ./dist`, no `main` — static assets, not a Worker), plus a `deploy` script and `wrangler` devDep on `apps/web`. Deployed with the workspace-pinned wrangler `4.116.0` (`npx wrangler` pulls 4.130.0, whose new Pages flow refuses to run from a workspace root — use `pnpm --filter @pixwagon/web exec wrangler` or run from `apps/web/`). Verified live against `https://pixwagon.pages.dev`: `/` and the deep links `/r/solo`, `/results`, `/r/solo/nonsense/deep` all → `200 text/html` (the `_redirects` `/* /index.html 200` SPA fallback resolves them, serving the shell with correct absolute `/assets/...` refs); and the real static files are **not** swallowed by that rule — `/manifest.webmanifest` → `application/manifest+json`, `/assets/*.js` → `application/javascript`, `/icon.svg` → `image/svg+xml`, all `200`. **Only the phone-on-mobile-data WebSocket join now remains for Accept** — a user-device step Claude cannot perform.

**Accept:** the Phase 0 Room DO is deployed to Cloudflare and a phone on mobile data joins it over a WebSocket.

---

## Phase 4 — Realtime skeleton

The riskiest infrastructure bet, validated in isolation. **No filling yet** — deliberately.

- Flesh out the protocol: join/leave, presence, round lifecycle, roll issuance.
- Room state in the Durable Object: players, mode, seed, round.
- Client WebSocket layer with reconnect and resync-on-reconnect.
- **Move the seat count somewhere both sides can read.** `MAX_SEATS` is defined in `apps/server/src/env.ts` and `playerColors.length` in `apps/web/src/design/tokens.ts`; the server cannot import the latter. Two definitions of "how many players fit" is a bug waiting for the day someone adds a seventh colour.
- **Hibernation-aware from the start**, not as a later optimisation: per-connection state lives in the socket attachment, never in an instance field, because the runtime may evict the object while sockets stay open. Getting this wrong is only visible under real idle traffic, which is the worst time to find it.

**Progress 2026-09-09 (server half — protocol + DO room state).** Split from the client half by decision this batch: the client WebSocket layer + reconnect/resync are their own next batch. Shipped:

- **Protocol fleshed out** (`packages/protocol`): `state` is now typed as `RoomSnapshot` (`{ code, mode, round, currentRoll: Roll | null, hostId, players: PlayerPresence[] }`) — the Phase 0 `z.unknown()` deferral is resolved. `presence`/`roll` typed to `PlayerPresence[]` / `Roll`. New `rollSchema` + `fallbackFaceSchema` (a hand-kept mirror of game-core's `FALLBACK_FACE_IDS`; `apps/server` carries a drift-guard test since it's the one layer that sees both packages). `delta` stays `z.unknown()` — deltas are board changes, which fills produce, which is Phase 5. New error code `not-host`.
- **Room state in the DO** (`apps/server/src/roomState.ts`, pure + unit-tested; `room.ts` is the CF glue): `{ code, mode, roomSeed, round, hostId }` in `state.storage` under one `room` key, never an instance field. Read→compute→write with no intervening non-storage `await`, so the DO input gate serialises it against a fast second message (host-only `request-roll` narrows the window further). `roomSeed` set once on first join; `round` is rolls-issued-so-far; `deriveSeed`/`issueRoll` unchanged so a late joiner's snapshot carries `currentRoll` without replay.
- **`request-roll` decided host-only** (was "Phase 4" in the contract's undecided list). Host = lowest-seat joined player, re-elected on every join/leave; non-host → `error: not-host`. One writer ⇒ every client sees the same roll, no peer race.
- **Seat count moved**: `MAX_SEATS` (`env.ts`) → `MAX_PLAYERS` in `@pixwagon/protocol`. Server imports it; `apps/web` pins `playerColors.length` to it with a test (`apps/web/src/design/playerColors.test.ts`). Deviates from handoff-02 engineering note 5's literal "use `playerColors.length`, remove `MAX_SEATS`" — the server can't import the web palette, so `protocol` is the shared home. `tokens.ts` unchanged (kept dependency-free); the test is the binding.
- Presence shape changed: `{ id, name, colorIndex }` → `{ id, name, seatIndex, isHost }`. Supersedes the `join`→`welcome`+`presence` observation in the Phase 3.5 memory note (which saw `colorIndex`). No `connected` flag yet — that lands with the reconnect half.
- **Verified**: `pnpm verify` green (187 tests, +23: protocol room-state shapes, `roomState.ts`, the drift guard, the web seat-count guard). **Nothing from this item is deployed** — the live worker at `pixwagon-app.tmsso.workers.dev` still runs the PR #16 code. Open, in addition to the Accept-line checks: (1) `wrangler deploy` the worker and confirm `/api/config` returns `{ maxPlayers: 6 }` from the new build — a `wrangler deploy` needs the user (the auto-mode classifier blocks it); (2) the two-device presence/roll check and the network-kill resync (no second device; resync is the deferred client half).
- **Decision recorded**: room `mode` is stored and defaults to `same-board`; no `set-mode` message yet (mode selection is a lobby concern, Phase 5/6). Room storage persists after every socket closes, so re-joining a code resumes mid-game rather than starting fresh — deliberate, it's the seam the reconnect half builds on.

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
