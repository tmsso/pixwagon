# Pixwagon

A browser-based, installable-PWA, real-time **roll-and-fill pixel game**. Players share a room code; each round the referee issues a polyomino-piece pair plus an independent fallback-die offer, and players place pieces to complete a pixel picture. Full mechanic in [`docs/mechanics-correction.md`](docs/mechanics-correction.md).

Inspired by roll-and-write pixel games. All art, shape data, palettes and copy in this repository are original.

**Status (2026-09-16): solo is playable and installable at [pixwagon.pages.dev](https://pixwagon.pages.dev); the multiplayer room server is deployed but not yet wired to the client.** Phases 0–3 are delivered, Phase 4 is half done. See [`ROADMAP.md`](ROADMAP.md) for the plan and [`docs/delivery-log.md`](docs/delivery-log.md) for what shipped when.

## Modes

| Mode       | Network             | Description                                               |
| ---------- | ------------------- | --------------------------------------------------------- |
| Same board | required            | Everyone fills the identical picture from the same offers |
| Own board  | required            | Parallel boards, own picture, compared at the end         |
| Solo       | offline             | Single player, no room, no referee                        |
| Daily      | offline after fetch | One shared seed per day                                   |

No accounts at launch — identity is a display name plus a room code.

## How it fits together

```
web (React PWA) ──WebSocket──> worker (router) ──> room (Durable Object)
      │                                                  │
      └──────── both import game-core + packs ───────────┘
```

`game-core` is a pure, I/O-free rules module imported by **both** the client and the server: the client runs it for instant optimistic UI and offline solo, the server runs the _same code_ as the authority. One rule set, no drift. Clients submit intent; the server validates and broadcasts truth.

Full reasoning in [`docs/architecture.md`](docs/architecture.md).

## Layout

| Path                 | What it is                                                                   |
| -------------------- | ---------------------------------------------------------------------------- |
| `packages/game-core` | Pure rules engine — seeded RNG, board model, move legality, scoring. No I/O. |
| `packages/packs`     | Shape-pack schema + pack data. Adding a theme is a data file, not code.      |
| `packages/protocol`  | Versioned WebSocket message types shared by client and server.               |
| `apps/web`           | React + Vite + TypeScript + Tailwind PWA. Canvas board renderer.             |
| `apps/server`        | Cloudflare Worker entry + the per-room Durable Object.                       |
| `design-system/`     | Generated preview bundle — the design system as Claude Design sees it.       |
| `docs/contracts/`    | The four contracts frozen early: pack schema, WS protocol, RNG, tokens.      |

## Development

Requires Node 22 LTS (see `.nvmrc`) and pnpm.

```bash
pnpm install
pnpm dev            # web app on :5173
pnpm dev:server     # room worker on :8787 (wrangler dev) — `pnpm dev` connects here
pnpm verify         # lint + typecheck + test + build + drift check
```

A local multiplayer test needs both `pnpm dev` and `pnpm dev:server` running; open two tabs on `http://localhost:5173/lobby`. The web app finds the worker through `VITE_ROOM_ORIGIN` (see `apps/web/.env.example`): unset, it is `http://localhost:8787` under `pnpm dev` and the live worker in a production build.

Generated files — `apps/web/src/design/tokens.css` and everything under `design-system/` — are produced by `pnpm tokens:build` and `pnpm design:build`, and are **committed**. CI regenerates them and fails if the working tree comes back dirty, so they can never silently drift from `tokens.ts`.

## Hosting

Everything targets a genuinely free tier: Cloudflare Workers + Durable Objects for rooms, Cloudflare Pages (or Workers static assets) for the front end. Durable Objects are available on the Workers Free plan **with the SQLite storage backend only** — see `docs/contracts/` and the Phase 3.5 gate in `ROADMAP.md`.

## Licence

[MIT](LICENSE) on our own code.
