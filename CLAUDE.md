# CLAUDE.md — Pixwagon

Project brief for Claude Code. Read this fully before writing code. `ROADMAP.md` defines build order; `docs/architecture.md` is the source design document (committed verbatim — do not edit it, record corrections beside it); `IDEAS.md` holds loose future ideas.

## Communicating with the admin

The admin is a non-developer tech lead — comfortable with technical jargon and reasoning, not with the specifics of modern web/JS tooling. On first use of a new technology, library or tool, give a one-line explanation of what it is and why it is being used here. Skip that for genuinely universal things (HTML, CSS, plain JavaScript). At the end of a planning session, include a short table of technologies introduced (name, what it is, why here) as a learning reference.

When code does something non-obvious — a trick, a subtlety, a workaround — explain the _why_ briefly in a comment. Several already exist in this repo; keep the habit.

## 1. What this is

A browser-based, installable-PWA, real-time roll-and-fill pixel game. Players share a room code; each round the referee issues a fair polyomino-piece pair (take both or decline) plus an independent fallback-die offer, and players place pieces to complete a pixel picture. See `docs/mechanics-correction.md` for the full mechanic — it corrects the dice/combo model `docs/architecture.md` still describes verbatim. Modes: same board, own board, solo, daily. Phone, tablet and PC from one codebase. No accounts — identity is a display name plus a room.

## 2. The five constraints that drive every decision

1. **Free-tier hobby hosting.** Every component must fit a genuinely free tier. No credit-card-required service on the critical path.
2. **Real-time, stateful rooms.** A live room holds connections plus shared state. This is the requirement a stateless serverless model cannot satisfy, and the reason the backend lives on Durable Objects.
3. **The server is the referee.** Offer fairness (the piece pair and fallback die a round issues) and move legality are validated server-side. Clients never self-report results in competitive modes. Determinism via seeded RNG so a room is reproducible.
4. **Theme-agnostic content.** Shape packs are data, not code. Adding a pack = adding a data file, no engine change. Phase 8 tests whether this held.
5. **PWA, offline-capable for solo and daily.** Multiplayer needs the network; solo and daily must not.

## 3. Stack

**Confirmed:** React + Vite + TypeScript (strict) · Tailwind v4 · Cloudflare Workers + Durable Objects · Cloudflare Pages · pnpm workspaces · Vitest · ESLint + Prettier.

Notes worth carrying:

- **Durable Objects on the free plan are SQLite-backed only.** Key-value-backed DOs still require a paid plan. `apps/server/wrangler.jsonc` declares the Room class with `new_sqlite_classes` for this reason, and the migration list is append-only — do not change that entry casually.
- **WebSocket Hibernation is not an optimisation here, it is the design.** Use `state.acceptWebSocket()`, keep per-connection state in the socket attachment, and never in an instance field: the runtime may evict the object while sockets stay open. The free tier's 13,000 GB-s/day budget assumes idle rooms cost nothing.
- **Tailwind v4 generates utilities from `@theme` only.** A custom property in a plain `:root` block produces no classes. This is why `scripts/build-tokens.ts` emits the light semantic values inside `@theme` and re-declares them for dark mode further down.
- TypeScript is pinned to 5.x even though 7.x exists, because the surrounding tooling (typescript-eslint in particular) targets 5.x. Revisit when the ecosystem catches up.

## 4. Architecture rules that must not erode

- **`packages/game-core` is pure.** No network, no filesystem, no `window`, no `WebSocket`, no Cloudflare globals, no imports from `apps/`. It runs unchanged in a browser tab and inside a Durable Object. The instant that stops being true, the client and the server can disagree about the rules, and every desync bug after that traces back here.
- **`packages/protocol` owns the wire format; `game-core` owns the rules.** Do not merge them. Rules must be reasonable about independently of how bytes travel.
- **Clients submit intent, servers broadcast truth.** A client never reports an outcome. Optimistic UI is a prediction the server may overturn.
- **A round's roll derives from `deriveSeed(roomSeed, round)`** — never from a single advancing stream. A late joiner must be able to compute round 7 without replaying rounds 1–6. See `docs/contracts/rng.md`.
- **`apps/server` holds both the router and the Durable Object** because a DO cannot be deployed independently of the Worker that binds it. They stay separate modules so the §4C/§4D responsibility split survives.

## 5. Generated files

Two things are generated **and committed**:

- `apps/web/src/design/tokens.css` — from `apps/web/src/design/tokens.ts` via `pnpm tokens:build`.
- `design-system/**` — from `scripts/design-system/cards.tsx` via `pnpm design:build`.

Never hand-edit either. CI regenerates both and fails if the working tree comes back dirty. They are committed rather than gitignored because Claude Design and anything else reading this repo read files on disk, not the output of a build they cannot run.

## 6. Accessibility rules, from day one not from Phase 9

- **Colour is never the sole signal.** Player identity carries a hatch pattern as well as a hue (`apps/web/src/design/patterns.ts`). Player colours come from the Okabe–Ito palette, chosen to survive the common colour-vision deficiencies. A design that distinguishes players by colour alone is wrong, however good it looks.
- **Minimum touch target is `--spacing-touch` (2.75rem).** Phone-first, one-handed reach.
- **Motion honours `prefers-reduced-motion`** through the duration tokens; do not hand-roll durations that bypass them.
- Icon-only controls require an accessible label — `IconButton` makes it a required prop rather than a convention.

## 7. Originality and legal guardrails

- All art, shape data, palettes and copy in this repo are **original**. No assets, rulebook text or visual identity from any existing commercial game.
- Ship under our own name. Do not name the repo, package or domain after another game's trademark.
- Public repo, MIT on our own code. The README may say "inspired by roll-and-write pixel games" — never "clone of «trademark»".
- When adding a pack, the pictures must be drawn for this project. Pixel art copied from an existing game is the exact thing this rule exists to prevent.

## 8. Working conventions

- `pnpm verify` before declaring anything done — it runs format, lint, typecheck, test, build, screen render, generated-file drift and design-card render. The real CI on GitHub is the authority, not a local pass.
- Do not start a roadmap phase before its predecessor's **Accept:** line is actually met.
- Record decisions where they will be found later: the phase entry in `ROADMAP.md`, or a comment at the site of the decision. Phase 2 and Phase 7 both have explicit "decide here and write it down" items.
