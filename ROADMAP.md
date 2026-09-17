# ROADMAP.md — Pixwagon build plan

**Rewritten 2026-09-16** after a full-repo review (`docs/review-2026-09-16.md`). The previous roadmap had grown into a 31 KB delivery narrative; it is preserved verbatim as `docs/delivery-log.md` (the record of what shipped, when, and why). This file is now only the plan: status, what is next, what must be decided, and what "done" means per phase. Phase numbers are unchanged, so every `ROADMAP.md Phase N` reference in code comments still resolves.

Companions: `CLAUDE.md` (rules and conventions — read first), `docs/architecture.md` (source design document, verbatim), `docs/mechanics-correction.md` (the real mechanic), `docs/contracts/` (the frozen seams), `docs/delivery-log.md` (history), `IDEAS.md` (backlog).

## How to work this file

- A phase is **Delivered** when its code is merged and CI-green, **Accepted** when its bold **Accept:** line has actually been observed. Delivered-but-not-Accepted is a normal state here because several Accept lines need a real phone; they are batched into the device session below rather than blocking the next phase.
- Sessions run as batches of one to three deliverables (`/next-batch`). Each deliverable lands as one PR with `pnpm verify` green locally and CI green on GitHub. A deliverable's "Done means" list below is the PR's acceptance check; do not reinterpret it mid-batch.
- When a batch makes a decision, write it in **two places**: a one-line entry under the phase in this file, and a comment at the site of the decision. Long narrative goes in `docs/delivery-log.md`, not here.
- Decisions D1–D4 below were the project owner's call and are decided (2026-09-16). New forks of the same weight go in a fresh "Decisions needed" section here and are asked up front, once, at the start of a batch.

## Status at a glance (2026-09-16)

| Phase | Name                                  | Code      | Accept line | Gap to Accept                                         |
| ----- | ------------------------------------- | --------- | ----------- | ----------------------------------------------------- |
| 0     | Repo and sync-ready scaffold          | delivered | ✅ met      | —                                                     |
| 0.5   | Design interlude (owner-driven)       | n/a       | ✅ met      | —                                                     |
| 1     | `game-core` rules engine              | delivered | ✅ met      | —                                                     |
| 2     | Local solo playable                   | delivered | ✅ met      | —                                                     |
| 3     | PWA shell                             | delivered | ⏳ device   | real-phone install + aeroplane-mode solo              |
| 3.5   | Cloudflare account and free-tier gate | delivered | ⏳ device   | phone on mobile data joins a room over WebSocket      |
| 4     | Realtime skeleton                     | half      | ⏳ device   | client WebSocket layer + reconnect/resync (next work) |
| 5     | Same-board multiplayer                | —         | —           | unblocked — D1–D3 decided 2026-09-16                  |
| 6     | Own-board mode, results, rematch      | —         | —           |                                                       |
| 7     | Daily puzzle + persistence            | —         | —           | daily seed needs no storage; see split below          |
| 8     | Second shape pack                     | —         | —           | can run any time after Phase 2                        |
| 9     | Polish                                | —         | —           |                                                       |

Live: web app `https://pixwagon.pages.dev` (Pages, deploys PR #18 build) · room worker `https://pixwagon-app.tmsso.workers.dev` (**still running PR #16 code; PR #19's protocol/room-state changes are merged but not deployed** — a `wrangler deploy` the owner runs).

## Execution order from here

1. **Device verification session** (owner, ~20 min, no code) — flips 3, 3.5 and half of 4's Accept lines in one go. Checklist below.
2. **Phase 4 client half** — the next code batch. Unblocked now.
3. ~~Decisions D1–D3~~ — decided 2026-09-16; Phase 5 can follow Phase 4 without a stop.
4. **Phase 5**, then **6**. **Phase 8** (second pack) is independent and is a good filler deliverable when a batch has room. **Phase 7** after 6. **Phase 9** last.

---

## Device verification session (owner-owned, no code)

Everything below needs a real phone and cannot be done by Claude. Run it once and paste results back; the session that receives them flips the Accept lines here.

1. Redeploy the worker so the live room server matches `main`: from `apps/server/`, `pnpm exec wrangler deploy`; then `curl https://pixwagon-app.tmsso.workers.dev/api/config` should return `{"protocolVersion":1,"maxPlayers":6}`.
2. **Phase 3:** on a phone, open `https://pixwagon.pages.dev`, finish one solo picture, accept the install card ("Add to home screen"). Enable aeroplane mode, launch from the home screen, play a few rounds of solo. _Accept if it boots and plays offline._
3. **Phase 3.5:** on the phone with Wi-Fi off (mobile data), open the browser console-free check: visit `https://pixwagon-app.tmsso.workers.dev/health`. A WebSocket join from a phone is only observable once the Phase 4 client half exists — so this item is _formally_ closed by step 4.
4. **Phase 4 (after the client half ships):** two devices join the same room code, both see both names, the host presses "Start round" and both see the same pair + single. Toggle aeroplane mode on one for ten seconds and back; it should show "Reconnecting…" then resync with no reload.

---

## Decisions D1–D4 — **decided 2026-09-16** (owner agreed to all four recommendations)

Kept in full so the reasoning stays findable. Each "Recommended" below is now the decision; Phases 4–6 assume them. Reopening any of them is an owner-level change, not a batch-level one.

**D1 — What "same board" means.** Two readings exist in the repo. (a) _Per-player copies of the identical picture_, everyone plays the same offers simultaneously on their own copy, ranked at the end — `docs/architecture.md` §1 ("all players fill the identical picture"), `game-core`'s `Board` (no per-cell owner) and the all-or-nothing scoring all assume this. (b) _One shared board, cells contested first-come_ — design pass 02's provisional surfaces `12a` ("your turn") and `03g` ("Sam reached them first") depict this. **Recommended: (a).** It keeps `Board`, `applyMove` and scoring unchanged, needs no per-cell ownership, and avoids exactly the reaction-speed unfairness `docs/mechanics-correction.md` rejected for the fallback reveal. Under (a), same-board and own-board differ only in which picture each player gets, so Phase 5 and 6 share one server model. The `03g` toast copy becomes "Those squares didn't fit — try another spot" (the solo copy), and `12a` is reinterpreted as "waiting for others to place".

**D2 — Turn model.** **Recommended:** simultaneous rounds. Every connected player submits one `fill` or `pass` per round; the round advances automatically when all connected players have acted; a player who disconnects mid-round is skipped for that round. No timer in v1 (a timer is a Phase 9 polish item, `IDEAS.md`). The host's only privilege stays "start the game / next picture / rematch".

**D3 — Session shape for v1 multiplayer.** The Phase 1 decision (a session cycles through the pack's pictures, ending on a precomputed round budget) stands, but it is more than Phase 5 needs to prove the referee. **Recommended slicing:** Phase 5 ships _one picture per session_ with a round budget; picture cycling lands in Phase 6 with own-board mode, where a per-player "current picture" already has to exist. Round budget formula, decided here unless overruled: `roundBudget = ceil(fillableCells(picture) / 3) + 4` — roughly the cells divided by a typical fallback fill, plus slack; stored in room state at picture start, not recomputed.

**D4 — Origins.** The web app and the worker are on different origins (`pixwagon.pages.dev`, `pixwagon-app.tmsso.workers.dev`). Cross-origin WebSockets work without CORS, so **recommended: keep two origins for now**, with the worker origin as a build-time constant (`VITE_ROOM_ORIGIN`, defaulting to the live worker in production and `http://localhost:8787` under `pnpm dev`). Consolidating onto Workers Static Assets (`IDEAS.md`) is a later, optional simplification — not a Phase 4 task.

---

## Phases 0–3.5 — delivered

Summaries only; the full record, including every dated correction, is in `docs/delivery-log.md`.

- **Phase 0 — scaffold.** ✅ Accepted 2026-07-31. Monorepo, contracts, tokens, design-system bundle, CI.
- **Phase 0.5 — design interlude.** ✅ Accepted 2026-08-15. Pass 01 at `docs/design/handoff/`; pass 02 (mechanic-accurate, PWA, provisional multiplayer) at `docs/design/handoff-02/`, landed 2026-09-04. Pass 02 Parts A and B are authoritative; Part C is provisional and subject to D1/D2.
- **Phase 1 — `game-core`.** ✅ Accepted 2026-08-01. Pair + fallback mechanic, shape library (9 free polyominoes, frozen order), legality, all-or-nothing scoring, property tests, achievability witness seed `achievability-0`.
- **Phase 2 — solo playable.** ✅ Accepted 2026-08-16. zustand `soloGame` store, canvas board, `PlacementEditor` sheet (reworked 2026-09-06 to pass 02's Annotation 09/11), real Home/Game/Results/PackPicker screens.
- **Phase 3 — PWA shell.** Delivered 2026-09-09 (PR #18). Service worker via `vite-plugin-pwa`, install-prompt state machine, update banner, offline Home, splash. **Accept pending the device session.**
- **Phase 3.5 — Cloudflare gate.** Delivered 2026-09-06/09 (PRs #16, #17). Free plan confirmed, SQLite-backed `Room` DO deployed, Pages deployed with SPA fallback. **Accept pending the device session.**

---

## Phase 4 — Realtime skeleton

**Server half delivered 2026-09-09 (PR #19), not yet deployed.** Protocol typed (`RoomSnapshot`, `PlayerPresence`, `rollSchema`), room state in DO storage (`{ code, mode, roomSeed, round, hostId }`), host-only `request-roll`, `MAX_PLAYERS` in `protocol`. Details in `docs/delivery-log.md` Phase 4.

**Client half — next batch.** Deliverables, in PR order:

1. ✅ **`apps/web/src/net/roomConnection.ts` — a transport class with no React.** Delivered 2026-09-17. Owns one `WebSocket`, encodes via `@pixwagon/protocol`'s `encode()`, exposes `send()`, `close()` and a single `onEvent` callback emitting `{status} | {message} | {decode-error}` — one callback rather than the `onMessage` this bullet originally specified, so connection-status transitions and decode failures are typed events too, not a second/third callback. Reconnect with capped exponential backoff (0.5 s → 8 s, jittered, backoff resets on a successful open) on any close that was not a deliberate `leave`. Constructed with a `WebSocket`-like factory (assignable `onopen`/`onclose`/`onmessage`/`onerror`, not `addEventListener`) so tests inject a fake with no real socket or DOM. `send()` while not open is a silent no-op — queuing across a reconnect is the rejoin layer's job (item 2), not transport's. **Done means:** ✅ unit tests for backoff timing (including the reset-on-open case), message decode errors surfacing as a typed event, and "deliberate close does not reconnect" — 7 tests, `pnpm verify` green.
2. **Rejoin identity.** Today a reconnect gets a fresh `playerId` and seat, which breaks Phase 5's board ownership. Add `rejoinToken?: string` to `join`; the server stores `token → { playerId, seatIndex, name }` in DO storage under `players` and reissues the same identity on rejoin, evicting a stale socket for that token if one is still open. The client keeps the token in `sessionStorage` per room code. `PROTOCOL_VERSION` stays `1` — nothing has shipped to real users. **Done means:** `roomState.ts` tests for reclaim / evict / seat retention; `docs/contracts/ws-protocol.md` "Decided in Phase 4" updated.
3. **`apps/web/src/state/roomGame.ts` — the room store**, separate from `soloGame` (decided Phase 2). Holds `RoomSnapshot`, `connection: 'connecting' | 'online' | 'reconnecting'`, `me: { playerId, isHost }`. `state` messages replace the snapshot wholesale (resync is "apply the snapshot", nothing cleverer). **Done means:** a store test replays a scripted message sequence (welcome → state → presence → roll → drop → reconnect → state) and asserts the final store equals the last snapshot.
4. **Lobby and networked Game screen, provisional design (pass 02 `02a–02e`, `12a–12c`).** Lobby: create room (`POST /api/room`), join by code (`RoomCodeInput`), player chips with seat colour + hatch, host sees "Start round". Game: `HudFrame` gets its `connection` pill; `RollControl` shows the server's roll; **no filling yet** — the sheet stays disabled with copy "Placing pieces arrives with the next update". Keep `/r/solo` on `soloGame` and route `/r/:code` to `roomGame` when `code !== 'solo'`. **Done means:** `scripts/check-screens.tsx` covers Lobby and the networked Game with a fixture snapshot; `pnpm verify` green.
5. **Origin config (D4)** and a `pnpm dev:server` script (`wrangler dev`) so a local two-tab test works without deploying.

Decided in this phase so far: host-only `request-roll` (2026-09-09); `MAX_PLAYERS` lives in `protocol` (2026-09-09); room storage persists after the last socket closes, so rejoining a code resumes rather than restarts (2026-09-09).

Known server caveat to verify in the two-device test: `Room.#reconcile` reads `getWebSockets()` inside `webSocketClose`; the closing socket is now excluded explicitly (2026-09-16) rather than relying on the runtime having dropped it already.

**Accept:** two devices join the same room code, see each other's presence, and see the identical seeded roll. Killing one client's network and restoring it resyncs without a page reload, keeping the same seat and name.

---

## Phase 5 — Same-board multiplayer (per D1(a), D2, D3 — decided 2026-09-16)

The core competitive loop: fills go through the referee.

1. **Server: per-player boards and the round lifecycle.** Room storage gains `boards: Record<playerId, Board>`, `acted: playerId[]` for the current round, `roundBudget`, `pictureId`. `fill` → `applyMove(board, currentRoll, move)`; accepted → store, reply `fill-accepted`, broadcast a typed `delta` (`{ playerId, round, cells }`); rejected → `fill-rejected` with the `MoveRejection` reason. A new `pass` client message replaces the solo store's local `passRound`. When every connected player has acted, the server issues the next roll itself (host no longer presses per round; the host starts the _game_). Session ends on picture complete for all, or budget exhausted; broadcast `round-result` typed as `RoundResult`. **Done means:** `roomState.ts` tests for accept/reject/advance/budget; a drift-guard test that `delta` and `game-core` `Board` agree.
2. **Protocol.** Type `delta`, `round-result`, add `pass`; drop the dice-era `cells` field from `fill-rejected` (the client knows what it sent). Add `error: 'already-acted'`.
3. **Client: optimistic fill and rollback.** `roomGame` reuses `placement.ts` (already pure) for composition; on commit, apply `applyMove` locally as the prediction, send `fill`, mark cells `candidate` until `fill-accepted`; on `fill-rejected` restore the board from the last snapshot and show the non-scolding line. `awaitingServer` dims the sheet (pass 02 `03f`). **Done means:** a store test where the server rejects a move the client predicted as legal, asserting the board rolls back to the pre-move state.
4. **Tamper test.** A test client sends a `fill` for cells the roll cannot cover; the server rejects it, and a second client's store never sees a delta for it.

**Accept:** an illegal fill submitted by a tampered client is rejected by the server and visibly rolls back on the client that attempted it, while other players never see it. Two phones play a full picture to the end and both see the same final ranking.

---

## Phase 6 — Own-board mode, picture cycling, results and rematch

- `mode: 'own-board'` assigns each player a different picture from the pack (seeded from `deriveSeed(roomSeed, 'pictures')`, so it is reproducible); same-board gives everyone the same one.
- Picture cycling (Phase 1 decision): after a picture resolves, the next one starts with a fresh `roundBudget`; the session ends when the pack is exhausted. Per-player `currentPictureIndex` in room storage.
- Results screen for rooms: ranked by completed pictures, then filled cells; `tied` and `leftMidGame` flags (pass 02 `13a–13c`); `BoardCompare` component (pass 02 note 6) added to the design system and re-synced.
- Rematch: same players, `roomSeed` rotated (`deriveSeed(oldSeed, 'rematch', n)`), boards reset.

**Accept:** two players finish different pictures from the same round-by-round offers; the results screen ranks them; rematch starts a new game without anyone rejoining.

---

## Phase 7 — Daily puzzle, then persistence

Split from the original single phase because the daily seed needs no storage at all.

- **7a — Daily, no server.** `dailySeed(date) = 'daily-' + YYYY-MM-DD` (UTC) fed to the existing solo store with a fixed picture rotation from the pack; works offline; Home's "Daily puzzle" button goes live. The only network use is none. **Accept:** the daily puzzle is identical across two devices in different browsers.
- **7b — Persistence.** Decide here: per-room SQLite inside the DO versus D1. The free tier already gives every DO SQLite storage, so D1 is only needed for cross-room data (a leaderboard). Recommended: local `localStorage` result history for solo/daily first, no server storage until a leaderboard is actually wanted. Write the decision in this file. **Accept:** a completed daily result survives a reload.

---

## Phase 8 — Second shape pack

Independent of Phases 4–7; a good single-PR filler. Ship a non-transportation pack (garden is already "coming soon" in the design) purely as data, drawn for this project.

**Accept:** the pack ships with **zero** changes to `game-core`, `apps/web` or `apps/server` — only a new file under `packages/packs/data/` plus its registration in `packages/packs/src/index.ts`. If anything else had to change, the seam leaked and that is the finding. (The registration line is the one known leak: consider a `data/index.json` manifest so even that goes away.)

---

## Phase 9 — Polish

- Reduced motion end to end; colour-vision simulation against real boards (hatches carry the distinction alone); small-phone layout, one-handed reach, safe-area insets; keyboard navigation and focus order across all surfaces; sound hooks off by default; the iOS Safari manual-install hint (no `beforeinstallprompt` there); optional round timer.

**Accept:** a full game is playable one-handed on a small phone, and playable in greyscale.

---

## Non-goals for v1

Accounts and auth, matchmaking beyond room codes, native app-store builds, monetisation, server-persisted history beyond daily results. The design leaves room for these; v1 does not build them.
