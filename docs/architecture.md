# architecture.md — "Pixwagon"

**For:** Claude Code (will derive the roadmap, phase breakdown, and tasks from this).
**Scope of this doc:** key components, how they connect, and the high-level order of delivery. **Not** full code, not a task list, not final file layout — Claude Code owns those.

---

## 1. Product in one paragraph

A browser-based, installable-PWA, real-time roll-and-fill pixel game. Players share a room code; each round a fair dice/combo is issued and players fill grid squares to complete a pixel picture. Modes: **same board** (all players fill the identical picture from the same dice), **own board** (parallel, own picture), **solo**, and **daily puzzle**. Targets phone/tablet/PC from one codebase. No user accounts at launch — identity is display name + room.

## 2. Guiding constraints (these drive every decision below)

1. **Free-tier hobby hosting.** Every component must fit a genuinely free tier. No credit-card-required services on the critical path.
2. **Real-time, stateful rooms.** A live room holds connections + shared state — this is the one requirement Vercel's stateless serverless model cannot satisfy, and the reason the backend lives on an edge/stateful-object platform.
3. **Server is the referee.** Dice fairness and move legality are validated server-side. Clients never self-report results in competitive modes. Determinism via seeded RNG so a room is reproducible/replayable.
4. **Theme-agnostic content.** Shape packs (transportation at launch, more later) are data, not code. Adding a pack = adding a data file, no engine change.
5. **PWA, offline-capable for solo/daily.** Multiplayer needs the network; solo and daily must work offline.

## 3. Recommended stack (Claude Code may challenge with justification)

- **Front end:** React + Vite + TypeScript, Tailwind. Board rendered on Canvas (or SVG) for crisp pixel scaling. PWA via manifest + service worker (Workbox).
- **Realtime backend:** Cloudflare Workers + **Durable Objects** — one Durable Object instance *per room* holds that room's authoritative state and its WebSocket connections. This is the core architectural bet: it turns "a live game room" into a single addressable stateful object, which is exactly the primitive this game needs and the thing Vercel lacks.
- **Persistence:** start with **none** (seeded rooms need no storage). Add Cloudflare **D1** (SQLite) or **KV** only when daily-puzzle seeds, saved results, or leaderboards land. Free-tier both.
- **Static hosting:** Cloudflare Pages (keeps front end and Workers on one platform, one free tier). Keeping the static front end on Vercel is an acceptable hybrid if preferred — only the room server *must* leave Vercel.

## 4. Key components and their responsibilities

### A. Game Core (pure, shared, no I/O) — `game-core`
The rules engine as a pure TypeScript module, importable by **both** client and server.
- Seeded RNG (dice/combo generation from a seed).
- Board model + shape-pack schema (grid, target picture, fillable cells).
- Move legality: given board state + a player's roll/combo + a proposed fill → valid or not.
- Win/completion detection and scoring.
- **Why shared:** client uses it for instant optimistic UI + offline solo; server uses the *same* code as the authority. One rule set, no drift. This module is the single most important thing to get right and stable first.

### B. Front-end App — `web`
- Renders the six screens (see design handoff): board, roll/combo control, lobby, home, results, pack picker.
- Board renderer (Canvas/SVG), touch + mouse input.
- Consumes design tokens from Claude Design output.
- Talks to the backend over one **WebSocket** per active room; falls back to local-only when offline (solo/daily).
- Owns optimistic fills, reconciled against server truth.

### C. Room Server (Durable Object) — `room`
- One instance per room code. Holds authoritative room state: players, mode, current seed, per-player boards/progress.
- Terminates the room's WebSocket connections; broadcasts state deltas.
- Runs `game-core` as the referee: issues seeded rolls, validates every fill, detects completion.
- Handles join/leave/presence, round lifecycle, rematch.
- Ephemeral by design — room evaporates when empty (until persistence phase adds opt-in saving).

### D. Edge Router / API — `worker`
- The Cloudflare Worker entry point: routes `create room` / `join room` to the right Durable Object, upgrades WebSocket connections, serves any small stateless HTTP (health, config, daily seed).
- Thin. Most logic lives in the Durable Object.

### E. Content / Shape Packs — `packs`
- Versioned data files defining each pack (transportation first): pictures, grids, palettes, difficulty.
- Loaded by client for rendering and by `game-core` for validation. Adding a pack touches only this.

### F. Persistence (deferred) — `store`
- D1/KV. Introduced only when daily seeds, saved results, or leaderboards are built. Isolated behind a small interface so early phases don't depend on it.

## 5. How they connect

```
                        ┌─────────────────────────────┐
                        │        web (React PWA)       │
                        │  board · lobby · results     │
                        │  imports game-core (client)  │
                        │  loads packs (render)        │
                        └───────┬─────────────┬────────┘
                    WebSocket   │             │  static assets
                    (per room)  │             │
                                ▼             ▼
                        ┌───────────────┐  ┌──────────────┐
                        │    worker     │  │ Cloudflare   │
                        │ route/upgrade │  │   Pages      │
                        └───────┬───────┘  └──────────────┘
                                │ routes to room by code
                                ▼
                        ┌─────────────────────────────┐
                        │   room (Durable Object)      │
                        │   authoritative state        │
                        │   imports game-core (referee)│
                        │   loads packs (validate)     │
                        └───────┬─────────────────────┘
                                │ (deferred)
                                ▼
                        ┌───────────────┐
                        │ store (D1/KV) │
                        └───────────────┘

  game-core  ── shared pure module, imported by BOTH web and room
  packs      ── shared data, read by BOTH web and room
```

Key connection facts:
- **`game-core` and `packs` are shared** by client and server — the whole design hinges on running identical rules in both places.
- Client↔server is **one WebSocket per room**, carrying: join/leave, roll issued, fill submitted, state delta, round/rematch, presence.
- Client submits *intent* ("fill cell X with my current combo"); server validates and broadcasts *truth*. Client shows optimistic result, reconciles on server delta.
- Solo/daily run entirely client-side against `game-core` — no `room`, no network. Same rules, no referee needed because there's no competition to protect.

## 6. Contracts to define early (before building features)

- **Shape-pack schema** — so packs and both consumers agree. Freezing this early unblocks parallel work.
- **WebSocket message protocol** — the message types above, versioned. This is the client/server seam; nail it before either side is fleshed out.
- **Seed → roll determinism** — the exact RNG contract, so client and server always agree on what was rolled.
- **Design tokens interface** — the shape of what Claude Design hands over (colors, type scale, player-color set), so `web` can consume it cleanly.

## 7. High-level order of delivery

Ordered by dependency and by "prove the risky thing first." Claude Code will turn this into phases/milestones with tasks.

1. **`game-core` + shape-pack schema.** Pure, testable, no I/O. The rules engine and the transportation pack schema. Heavily unit-tested. Everything depends on this; it also de-risks the game itself before any infrastructure exists.
2. **Local solo playable.** `web` + `game-core` + one transportation pack, no network. A single player can complete a board in the browser. Proves the game is fun and the board interaction works before adding multiplayer complexity. Ships as a static page.
3. **PWA shell.** Manifest + service worker so solo/daily install and run offline. Cheap to add here, validates the "light app" promise early.
4. **Realtime skeleton.** `worker` + `room` Durable Object + WebSocket protocol. Two clients join a room by code and see each other's presence and a shared seeded roll. No filling yet — just prove the stateful-room primitive and the protocol end to end. **This is the riskiest infra bet; validate it in isolation.**
5. **Same-board multiplayer.** Wire filling through the server referee: server issues rolls, validates fills, broadcasts deltas; clients reconcile. The core competitive loop.
6. **Own-board mode + results/compare.** Parallel boards, end-of-round comparison, rematch.
7. **Persistence (`store`) + daily puzzle.** D1/KV for daily seeds, saved results, optional leaderboard. First point storage is needed.
8. **Second shape pack.** Prove extensibility by shipping a non-transportation pack through the `packs` seam with zero engine change. If this is easy, the theme-agnostic constraint held.
9. **Polish pass.** Reduced-motion, colorblind-safe player colors, small-phone layout, keyboard focus, sound hooks.

Rationale for the order: **prove the game (1–3) before the infrastructure (4–5)**, and **prove the hardest infrastructure primitive (4) in isolation** before building competitive features on top of it. Persistence and extra content come last because nothing early depends on them.

## 8. Non-goals for v1
Accounts/auth, matchmaking beyond room codes, native app store builds, monetization, server-persisted history beyond daily seeds/results. Design leaves room for these; v1 doesn't build them.

## 9. Legal/repo guardrails (carry into code)
- All art, shape data, palettes, and copy are original. No assets, rulebook text, or visual identity from any existing commercial game in the repo.
- Ship under our own name; don't name repo/package/domain after another game's trademark.
- Public repo is fine; MIT license on our own code. README may say "inspired by roll-and-write pixel games" — not "clone of \<trademark\>".

---

## 10. Tooling & handoff wiring (Code-first, then design-sync)

This section defines the *order of operations between Claude Code and Claude Design*, so design output arrives production-aware and no attachments are hand-copied into the repo. Chosen approach: **scaffold the repo first, then sync design to it.**

### Why code-first
`/design-sync` (in Claude Code) imports a **snapshot** of the repo's design system — real tokens and component names — *into* Claude Design, so every screen Design generates uses our actual components instead of approximated colors and invented names. That only works if the tokens/components exist in the repo *before* Design generates screens. So the token contract in §6 must be a real file in the repo, not a plan. Hence: scaffold → sync → design → handoff.

### Prerequisites (verify on the account before relying on this)
- Claude Code **v2.1.181+** (run `claude update`). `/design-sync` and the direct handoff were beta on Pro/Max/Team/Enterprise as of the June 2026 rollout.
- Repo pushed to **GitHub** (import can also read a design system directly from a GitHub repo or a file upload, not only the local codebase).
- If unavailable: fall back to the Export bundle (§10 "Fallback").

### Delivery order for the wiring (front-loads into Phase 1)
1. **Scaffold the repo** with the pieces `/design-sync` needs to find:
   - `game-core` skeleton (types + stubs; real logic follows in the build phases).
   - A concrete **design-token module** — the colors, type scale, spacing, and player-color set from §6, as actual code (e.g. a Tailwind config / CSS variables / a `tokens.ts`), even if provisional values. This is the artifact sync reads.
   - A **component-shell** for the named UI primitives (Button, board cell, HUD frame, etc.) — empty but real, so Design binds to real component names rather than inventing them.
   - `packs` schema stub + the transportation pack as data.
   - Push to GitHub.
2. **Run `/design-sync` (pull)** inside a Claude Code session on the repo. This imports the token/component snapshot into Claude Design.
3. **Generate the six screens in Claude Design** — they now start from our real tokens and component names, and Design self-checks its output against the imported system before showing results.
4. **Refine on the Design canvas**, and use **canvas annotations** for implementation notes ("board cell needs a filled/press/locked state," "player colors must stay distinct for colorblind users"). Annotations travel with the handoff.
5. **Hand off to Claude Code.** Two distinct paths — pick by intent:
   - **Handoff button** → opens a **new** Claude Code session preloaded with the design context (components used, layout, annotations). Use when starting fresh implementation.
   - **`/design-sync` (pull) in an existing session** → use when Claude Code is already mid-build and you want to bring the current design state into the running session instead of spawning a new one.
6. **Push back after implementation** with `/design-sync` (push) to keep the Design canvas current with what was actually built.

### The one habit that prevents drift
Sync is a **snapshot, not a live watch.** Any time the token module or component shells change in the repo (which they will, as `game-core` and the board firm up), **re-run `/design-sync`** to bring Design current — same discipline as regenerating types after a schema change. Stale sync = Design generating against old tokens.

### What this removes
No exporting images, no pasting screenshots into Claude Code, no hand-copying design attachments into the repo. The design system lives in git; both tools reference it there; the handoff carries layout + annotations natively.

### Fallback (if beta features aren't on the account)
Use Claude Design's **Export → "Hand off to Claude Code"** bundle (.zip of design files + chat + an auto-generated README + a paste-in prompt). It drops into the repo in one step — still no per-attachment copying, just without the two-way token sync. In this mode, keep the §6 token contract as the manual source of truth and reconcile once at implementation.

### Effect on the phase plan
This wiring means **Phase 1 is not just `game-core`** — it also stands up the token module, component shells, and `packs` stub, and pushes to GitHub, specifically so `/design-sync` has something real to import before any screen is designed. Claude Code should treat "repo is sync-ready" as a Phase 1 exit criterion.
