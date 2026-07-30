# Contract: design tokens

**Source of truth** `apps/web/src/design/tokens.ts` · **Generated** `tokens.css`, `design-system/**`

The fourth seam in `docs/architecture.md` §6 — the shape of what the design handoff binds to.

## All current values are provisional

They are plausible and internally consistent placeholders, not a considered visual identity. Their job is to give Claude Design real token _names_ to bind to so it never invents its own. Expect the values to be replaced after the design pass; expect the names and the file's shape to survive.

## Why TypeScript is the source, with CSS generated from it

The board is a Canvas renderer. `ctx.fillStyle` needs an actual colour string, and reading it back out of a stylesheet at runtime via `getComputedStyle` would not work in tests or inside a Durable Object. CSS-only tokens would fail the single most important surface in the app.

So `tokens.ts` is the source, and `pnpm tokens:build` generates `tokens.css`. Both are committed; CI regenerates and fails on a dirty tree, so they cannot drift.

## Tailwind v4 specifics that shape the output

- **Utilities generate from `@theme` only.** A custom property in a plain `:root` block yields no classes. The light semantic values therefore live in `@theme` (that is what mints `bg-accent`, `text-ink`, …), and the dark theme re-declares the same properties further down. Generated utilities resolve their `var()` at use time, so they follow the override automatically.
- **The numeric spacing scale derives from one `--spacing` base step**, not from individually declared `--spacing-4` keys. Only genuinely named steps (`touch`) are declared.

## Token groups

| Group                                  | Notes                                                                        |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| `palette`                              | Raw ramp. Components should prefer semantic tokens.                          |
| `semanticLight` / `semanticDark`       | `bg`, `surface`, `ink`, `accent`, `border`, plus board-specific `cell-*`.    |
| `playerColors`                         | See below — the most constrained group.                                      |
| `fontFamily`, `fontSize`, `fontWeight` | Mono is for room codes, dice and scores: anything that must not shift width. |
| `spacing`, `radius`, `shadow`          | 4px base step.                                                               |
| `duration`                             | Collapsed to 0 under `prefers-reduced-motion`, centrally.                    |
| `minTouchTarget`                       | 2.75rem. Every interactive control must meet it.                             |

## Player colours are a hard constraint, not a palette choice

Derived from the **Okabe–Ito** qualitative palette, designed to stay distinguishable under protanopia, deuteranopia and tritanopia.

Each colour is paired with a **hatch pattern** (`design/patterns.ts`). Colour must never be the sole signal: two players stay tellable apart in greyscale, in a screenshot, and to a viewer who perceives no hue difference. `MAX_PLAYERS` is derived from the number of distinct colours, so a room cannot seat more players than we can visually distinguish.

A design that identifies players by hue alone is wrong, however good it looks. The Canvas renderer must reproduce the hatches too — `patternStyle()` describes the geometry in one place so that port is mechanical.

## The habit that prevents drift

`/design-sync` uploads a **snapshot**, not a live view. Any time `tokens.ts` or a component shell changes, re-run `pnpm design:build` and re-sync — the same discipline as regenerating types after a schema change. Stale sync means Design generating against old tokens.
