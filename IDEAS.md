# IDEAS.md — Pixwagon

Loose backlog. Nothing here is scheduled; `ROADMAP.md` is the plan. Pick things up opportunistically or promote them into a phase.

## Gameplay

- **Spectator mode.** Join a room by code without a seat — useful when a room is full at 6.
- **Asynchronous rooms.** A room that persists between sessions so a game can be resumed the next day. Depends on Phase 7 persistence.
- **Handicap.** Extra combo options or a head start, for playing with kids.
- **Puzzle chains.** A picture that unlocks the next one, giving solo a shape beyond one-off boards.
- **Roll history / replay.** Seeded rooms are reproducible by construction, so a replay is mostly a UI. Would make "that was unfair" arguments settleable.

## Content

- Pack ideas beyond transportation: garden, kitchen, weather, instruments, tools. Each must be drawn originally.
- **Pack authoring tool** — a small local page that turns a drawn grid into pack JSON. The `rows`-as-strings format was chosen partly so this stays trivial.
- Seasonal daily puzzles.

## Technical

- **Board rendering via `OffscreenCanvas` + a worker** if the main thread struggles on large grids on low-end phones. Measure before building.
- **Delta compression** on the WebSocket if room state grows — currently a non-issue.
- **Cloudflare Workers Static Assets instead of Pages.** Would let the static front end and the Worker deploy as a single unit rather than two. Worth evaluating at Phase 3.5 when the account exists.
- **Turbo/nx** if the workspace ever grows enough to justify a build orchestrator. It does not today.
- A tiny **status page** for the daily puzzle, so a broken daily is visible without playing it.

## Polish

- Sound design: dice, fill, completion. Off by default; hooks land in Phase 9.
- Haptics on fill, on mobile.
- Shareable result card (image) for a completed daily — the one social feature that needs no accounts.
- Colour-vision simulation in Storybook-equivalent form, so the Phase 9 check becomes a permanent regression guard rather than a one-off review.
