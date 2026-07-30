# Pixwagon

A browser-based, installable-PWA, real-time **roll-and-fill pixel game**. Players share a room code, a fair dice/combo is issued each round, and everyone fills grid squares to complete a pixel picture.

Inspired by roll-and-write pixel games. All art, shape data, palettes and copy in this repository are original.

**Status: Phase 0 — scaffold.** The repo structure, design tokens and contracts are in place; the rules engine and gameplay are not built yet. See [`ROADMAP.md`](ROADMAP.md).

## Modes

| Mode       | Network             | Description                                             |
| ---------- | ------------------- | ------------------------------------------------------- |
| Same board | required            | Everyone fills the identical picture from the same dice |
| Own board  | required            | Parallel boards, own picture, compared at the end       |
| Solo       | offline             | Single player, no room, no referee                      |
| Daily      | offline after fetch | One shared seed per day                                 |

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
pnpm verify         # lint + typecheck + test + build + drift check
```

Generated files — `apps/web/src/design/tokens.css` and everything under `design-system/` — are produced by `pnpm tokens:build` and `pnpm design:build`, and are **committed**. CI regenerates them and fails if the working tree comes back dirty, so they can never silently drift from `tokens.ts`.

## Hosting

Everything targets a genuinely free tier: Cloudflare Workers + Durable Objects for rooms, Cloudflare Pages (or Workers static assets) for the front end. Durable Objects are available on the Workers Free plan **with the SQLite storage backend only** — see `docs/contracts/` and the Phase 3.5 gate in `ROADMAP.md`.

## Licence

[MIT](LICENSE) on our own code.
