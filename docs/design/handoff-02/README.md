# Handoff: Pixwagon pass 02 — mechanic-accurate surfaces + PWA + provisional multiplayer

Landed at `docs/design/handoff-02/`, not the `docs/design/handoff/README.md` path
`BRIEF-02.md`'s "After the pass" section asked for — that path is pass 01's
handoff (2026-08-09) and still holds the record of what shipped from it
(`DiceFace.tsx`'s combo-stacking fix). Overwriting it would have destroyed that
record, which `ROADMAP.md`'s Phase 0.5 entry and Phase 1 still point to. This
pass gets its own numbered directory instead, the same pattern already used for
`BRIEF.md` → `BRIEF-02.md`. See `../handoff/` for pass 01.

## Overview

Design pass 02 for Pixwagon, answering `BRIEF-02.md`. It corrects every surface to the real
mechanic (a polyomino **pair** vs. an independent **single** die value, chosen freely each round),
redesigns the Game turn flow end to end, adds the placement editor as its own surface, adds the
Phase 3 PWA surfaces, and forward-designs multiplayer behind a provisional divider.

Built against the real source, not the stale brief: `shapes.ts`, `placement.ts`, `offerView.ts`,
`RollControl.tsx`, `PlacementEditor.tsx`, `DiceFace.tsx`, `HudFrame.tsx`, `GameScreen.tsx`,
`tokens.ts`, `patterns.ts`, and the Transportation pack pictures.

## About the design files

`Pixwagon - pass 02.html` is a **design reference created in HTML** — a static prototype showing
intended layout, states and copy. It is not production code to lift. Recreate these designs in
`apps/web` with the existing React + TypeScript component set and Tailwind token classes. The
prototype's CSS classes are scaffolding for the reference only; the real implementation uses
`Button`, `Panel`, `HudFrame`, `RollControl`, `PlacementEditor`, `BoardCanvas`, `BoardCell`,
`PlayerChip`, `PieceGlyph`, `DiceFace`, `PackCard`, `PicturePreview`, `RoomCodeInput`, `IconButton`,
`Dialog`.

Open the reference and pan; it is one canvas. Frames are captioned `03a`, `03b`, … and the numbered
dark cards are the annotations.

**Note on the CSS chain in this bundle:** `pass02.css` imports `pixwagon-surfaces.css`, which
imports `styles.css` — all three sit in this directory. This `pixwagon-surfaces.css` is a
pass-02-specific rebuild of the base styles, generated fresh from `tokens.ts`/`patterns.ts` for
this pass; it is a **different file** from `../surfaces/pixwagon-surfaces.css` (pass 01's, 755
lines, hand-written) despite the shared name — the two are not interchangeable and neither imports
the other. Don't move either file into the other pass's directory.

## Fidelity

**High-fidelity.** Final layout, copy, states and spacing, using the current provisional token
values unchanged. No token was renamed, added or revalued this pass.

---

## What was implemented

### Part A — corrective surfaces (authoritative)

**Surface 01 · Home** — three states (first visit / returning with a daily / daily complete).
Direction unchanged from Phase 0.5; all dice/combo language scrubbed ("Same picture, same offers").

**Surface 03 · Game** — eight states, the centre of this pass:
`03a` offer shown, nothing chosen · `03b` pair chosen, 0 of 2 placed · `03c` pair, 1 of 2 placed
with a ghost on the board · `03d` single chosen, two blobs, one still short · `03e` complete, ready
to commit · `03f` awaiting the referee (dimmed, layout stable) · `03g` rejected and rolled back ·
`03h` no legal move, pass.

**Surface 04 · the offer control (`RollControl`)** — nine state cards: waiting for the offer,
rolling, both shown, pair chosen, single chosen, awaiting the referee, rejected, no legal move,
round scored.

**Surface 07 · piece & blob composition (`PlacementEditor`)** — new. Six state cards plus an
iconography specimen and the board-scale specimen.

**Surface 05 · Results** — three states: solo complete, solo stranded (unfinished, scores zero),
and session over across the pack.

**Surface 06 · Pack picker** — two states: pack list and inside a pack. Unchanged in direction.

### Part B — PWA (authoritative)

`08a` install prompt (after a completed picture) · `08b` dismissed, quiet entry point remains ·
`09a` offline Home · `09b` offline solo game (visually identical to online solo) · `10` new version
available · `11` splash / first paint.

### Part C — multiplayer (PROVISIONAL, below the divider)

`02a–02e` Lobby in full (entering a code, invalid code, waiting 1 of 6, ready 3 of 6, full 6 of 6) ·
`12a–12d` Game networked (your turn, waiting on another player, reconnecting with a dropped player,
own-board mode) · `13a–13c` Results own-board (ranked with pictures side by side, tie with someone
who left, rematch).

### Annotations

01–08 kept as stable addresses, unrenumbered and unrescoped (01, 02 and 04 restated on canvas where
this pass extends or leans on them). New: **09** on-board placement gesture · **10** offer naming ·
**11** board scaling rule · **12** how the Game footer stack resolves · **13** both offers always
shown, in order · **14** composition copy, not debug output · **15** all-or-nothing scoring copy ·
**16** offline is a state, not an incident · **17** first paint and reduced motion · **18** six
seats and why (provisional) · **19** presence, turn and invisible rollback (provisional) · **20**
two proposed components (provisional).

---

## What was NOT implemented

- **Repo-side prerequisite 2 was not done, and could not be done from here.** There is no
  `placement-editor` card in the synced design system (14 component cards, not 15), so
  `PlacementEditor` had no preview to bind to. Rather than invent a name, this pass was designed
  from `PlacementEditor.tsx` source directly. **Add the card, run `pnpm design:build` →
  `pnpm design:check` → `/design-sync` before the next pass.**
- **No commit, PR or branch was pushed.** Only read access to `tmsso/pixwagon` was available. The
  `DiceFace` two-line change carried over from pass 01 is still uncommitted in code.
- **The stale `BRIEF.md` was not resolved.** Prerequisite 1 is still open: two briefs disagree
  about the core mechanic.
- **No `ROADMAP.md` Phase 2.5 entry** (optional prerequisite 4).
- **Dark mode.** `semanticDark` exists in `tokens.ts`; no surface in this pass shows it.
- **Desktop and tablet layouts.** Phone-first per the constraints; only the board-scale rule
  (Annotation 11) speaks to larger screens. The Game screen's larger-viewport arrangement (the
  sheet is a phone pattern) is not designed.
- **Dialog usage.** The `Dialog` card exists and no surface here needs it. Deliberate: the update
  prompt is a banner and the placement editor is a sheet, precisely so neither interrupts a round.
- **Same-board multiplayer conflict UI beyond the toast** in `03g`/`12c`.
- **Daily-puzzle streaks, history, or any persistence surface** — there are no accounts, so there is
  nothing to show.
- **Real pack art beyond Transportation.** Garden is "coming soon" everywhere, as in the data.

---

## Screens / views

Read the canvas for exact composition. Per-surface specifics an implementer needs:

### Surface 03 · Game — the layout that resolves the vertical budget

`HudFrame` unchanged: header (room code, round, optional connection pill) → players row → `main`
(board, centred) → `footer` (`RollControl`). The new part:

- **`PlacementEditor` is a sheet**, not a footer sibling. It mounts absolutely over the bottom of
  the viewport: full width, `radius.xl` on the top two corners, `shadow.lg`, 1px `border` top edge,
  `surface` background, 10px 16px 16px padding, 12px internal gap, with a 36×4px `border`-coloured
  grip centred at the top and a `rgb(14 18 22 / 0.18)` scrim over the board behind it.
- Sheet height is **fixed at 284px** (34% of 844) — the same for pair and single composition, so
  switching offers never resizes it. While it is open the board area reserves exactly 284px as
  bottom padding and re-centres its content in what is left, making the gap above the sheet
  identical in every composition state.
- **The board is 269×185px in every Game state and is never occluded.** It moves exactly once:
  opening the sheet re-centres it 76px upward, one settle at the start of composing. After that
  nothing moves while the player is placing — **the board's size must not change between `03a` and
  `03f`, and its position must not change once the sheet is open.**
- Sheet contents, top to bottom: grip → chosen-offer bar → piece/blob radiogroup → tool row →
  commit row.
- **Chosen-offer bar**: `min-height 2.75rem`, `accent` 1px border, `accent`/10 background,
  `radius.lg`, 6px 12px padding, holding the offer label (mono `xs`, uppercase, 0.08em,
  `ink-muted`), a small glyph pair or die, and a right-aligned "Switch" text action in
  `accent-hover`. This is how the offer cards collapse without disappearing.
- **Commit row**: `Place N squares` (primary, `lg`, `flex:1`) + `Cancel` (secondary, `lg`). Disabled
  until `isPendingComplete`. Label comes from `pendingCellCount`.
- **`03f` awaiting the referee**: the whole sheet drops to 55% opacity, every control disabled and
  still mounted, commit reads `Placing…`. Nothing unmounts, nothing resizes.
- **`03g` rejected**: sheet dismissed, offers return, rejected cells render `BoardCell.invalid`, and
  the toast names who got there first — "Those two squares went back — Sam reached them first."
  `role="alert"`. Never scolding, never "invalid move".
- **`03h` no legal move**: both offer cards stay mounted at 50% opacity and a secondary `lg`
  `Pass the round` is added below. Exact legality check, not a size heuristic.

### Surface 07 · composition — the copy and control changes

| Was | Now |
| --- | --- |
| `placed at (3, 5)` | `Tap the board` → `On the board` |
| `2/3` | a dot row (filled/empty) + `1 more square` |
| `blob 1` / `blob 2` | nothing — the dot row and the count carry it |
| `⟳ ⇋ ×` raw glyphs | outline icons + visible labels `Turn` `Flip` `Take back` |

- **Piece/blob cards** (`role="radiogroup"`, each `role="radio"`): `min-height 2.75rem`, 1px
  `border`, `radius.lg`, `surface`, 8px 12px, 4px gap, column, centred. Active: `accent` border,
  `accent`/10 background, `shadow.sm`, and its status line goes `accent-hover` at weight 500.
  Already-placed: `border` border, `surface-sunken` background.
- **Tools**: `min-height`/`min-width 2.75rem`, 1px `border`, `radius.lg`, icon 22px above a 10px
  label in `ink-muted`. Disabled at 40% opacity — `Take back` is disabled until something is placed.
  For the single, only `Take back` appears: a blob has no orientation.
- **Icons**: geometric outline, 24px viewBox, **1.7px stroke, square caps, `currentColor`**, no
  fill. `Turn` = a square with a clockwise arc and arrow head. `Flip` = a dashed vertical axis with
  a mirrored bracket each side. `Take back` = a square with an X. The label is the accessible name;
  no tooltip-only affordances.

### Everything else

Composition, copy and state coverage for Surfaces 01, 02, 04, 05, 06, 08–13 are on the canvas with
per-frame captions. Copy in the reference is final copy.

## Interactions & behavior

- **Placement gesture (Annotation 09).** *Pair*: tap a board cell to drop the active piece's origin;
  tapping elsewhere **moves** it, never adds a copy. `Turn`/`Flip` transform the placed ghost in
  place, pivoting on the origin cell. Placing the active piece hands focus to whichever piece is
  still unplaced (`placeActiveOrigin` already does this). *Single*: taps toggle cells into the
  active blob; tapping a chosen cell removes it. Contiguity is checked at commit, never per tap, so
  a player can backtrack through an invalid detour.
- **Ghost vs. candidate.** The uncommitted placement renders as a distinct state from a filled cell
  and from `candidate`: `accent` at 35% with a 1px `accent` border for the active piece, 20% with a
  dashed border for the other. The ghost is the un-broadcast move; in multiplayer nobody else ever
  sees it.
- **Optimistic fill → rollback.** Commit sends intent, board shows the ghost, referee answers.
  Accepted → cells become filled in the player's seat colour+hatch and broadcast. Rejected → cells
  flip to `BoardCell.invalid`, toast names the claimant, offers return. Other clients receive the
  move only after acceptance.
- **Board rendering.** Canvas, `imageSmoothingEnabled = false`, whole board snapped to whole device
  pixels at `devicePixelRatio`. Cell size steps **20 → 28 → 40px** at 768px and 1180px and takes no
  value between. Centre the board in its area; never scale to fill; leftover space is margin. If a
  picture at the chosen step would exceed available width, drop a step. 1px gap, no corner rounding,
  no per-cell shadow.
- **Connection pill.** Only inside a networked room. `connecting` uses `warning`/20 background with
  `ink` text — never `danger`. Solo and daily show no pill at all.
- **Offline.** Solo/daily screens are byte-identical online and off. Home gains one neutral
  `surface-sunken` `Offline` pill and one line naming only what is unavailable (playing with
  friends). No red, no modal, no blocking.
- **Install prompt.** Appears only after a completed picture, never on first load. "Not now"
  suppresses 30 days; a second dismissal retires it permanently, leaving the ghost button on Home.
- **Service-worker update.** A banner, never a dialog, and it waits for the results screen if a
  round is in progress.
- **Splash.** Cached shell: mark, wordmark, and a determinate bar only if boot exceeds 400ms.
  Background is `bg`, matching Home, so the handoff is invisible.
- **Motion.** Sheet in/out at `duration.slow`; offer and tool state changes at `duration.fast`;
  the rolling shimmer pulses opacity 1 → 0.45 → 1 over 1.6s. Under `prefers-reduced-motion` the
  `duration` tokens zero and each animation has a static equivalent: the sheet appears without
  sliding, the boot bar becomes a static label, the shimmer becomes plain "Rolling…" text.
- **Touch targets.** Everything interactive ≥ `minTouchTarget` (2.75rem). Primary action in the
  lower half on every screen.

## State management

Existing store shape is right; this pass needs no new state machine. What it reads:

- `pending: PendingChoice | null` — `{kind:'pair', pieces:[PendingPiece,PendingPiece], active:0|1}`
  or `{kind:'fallback', blobs:PendingBlob[], active:number}`. `pending !== null` is exactly "the
  sheet is open".
- `isPendingComplete(pending)` gates the commit button; `pendingCellCount(pending)` writes its
  label; `candidateCells(pending)` feeds the board — split it so the **active** piece/blob renders
  as the strong ghost and the rest as the weak ghost.
- `lastRejection` drives the toast, the `invalid` cells, and (multiplayer) the claiming player's
  name — which the current `lastRejection: string | null` cannot carry. Widen it to include the
  claimant, or the copy in `03g` cannot be written.
- `awaitingServer` (RollControl) is the dim-everything window.
- `canPass` unchanged: no pending, playing, and neither `pairHasLegalPlacement` nor
  `fallbackHasLegalPlacement`.
- New, small: `installPromptState` (`eligible | suppressed-until | retired`) and
  `updateReady: boolean`, both local-only. `connectionStatus` already exists as `HudFrame`'s
  `connection` prop.

Provisional (Phases 4–6): `RoomState` with `players[]` (id, name, seatIndex, isHost, presence),
`boardMode: 'same' | 'own'`, `turn`, per-player `progress` for own-board chips, and rankings with
`tied` / `leftMidGame` flags.

## Design tokens

All values are the current provisional `tokens.ts` values, **unchanged**. Bind to names, not hexes.

- **Semantic (light):** `bg #f6f7f9` · `surface #ffffff` · `surface-sunken #eaedf1` ·
  `border #d3d9e0` · `ink #171c21` · `ink-muted #5a6673` · `ink-inverted #ffffff` ·
  `accent #2a9d8a` · `accent-hover #1f7a6c` · `accent-ink #ffffff` · `warning #e8853a` ·
  `danger #d64a3f` · `cell-fillable #d3d9e0` · `cell-blank #f6f7f9` · `cell-locked #adb7c2`
- **Player colours** (hue **and** hatch, via `patternStyle()`): Cobalt `#0072b2` solid ·
  Vermillion `#d55e00` diagonal · Teal `#009e73` dots · Amber `#e69f00` horizontal ·
  Orchid `#cc79a7` cross · Sky `#56b4e9` vertical. `MAX_PLAYERS = 6`.
- **Type:** sans `Inter Variable`, mono `JetBrains Mono Variable`. Sizes `xs .75` · `sm .875` ·
  `base 1` · `lg 1.125` · `xl 1.375` · `2xl 1.75` · `3xl 2.25` · `display 3` rem. Weights
  400/500/600/700. Phone headings use `2xl`; `display` is not used on a 390px screen. Eyebrow =
  mono 600, 11px, 0.12em, uppercase, `ink-muted`. Scores, room codes and counts are always mono.
- **Spacing:** 4px base — 8 / 12 / 16 / 24px in these layouts; screen padding 16px.
- **Radius:** `sm .25` · `md .5` · `lg .875` · `xl 1.25` rem · `full`.
- **Shadow:** `sm 0 1px 2px rgb(14 18 22/.08)` · `md 0 4px 12px rgb(14 18 22/.10)` ·
  `lg 0 12px 32px rgb(14 18 22/.16)`.
- **Motion:** `instant 0` · `fast 120ms` · `normal 200ms` · `slow 360ms`.
- **Touch:** `minTouchTarget 2.75rem`.
- **Proposed value changes:** none. Names and values both survive this pass.

## Assets

No bitmap or vector assets. All board and picture renders come from the real Transportation pack
(`packages/packs/data/transportation.json`) — Tram, Sailboat, Hot-air balloon — drawn from row
strings plus palette. No pixel art was invented. `render-pictures-02.js` in this bundle is the
reference's prototype renderer (pass 01's `render-pictures.js` plus ghost-cell support); it is
**not** for porting — the real app draws boards with `BoardCanvas`.

Icons are original geometric outline SVGs defined inline at the top of the reference file
(`#ic-rot`, `#ic-mir`, `#ic-clr`, `#ic-back`, `#ic-edit`, `#ic-install`, `#ic-offline`,
`#ic-refresh`). Lift the path data directly.

## Files

All in this directory (`docs/design/handoff-02/`):

- `Pixwagon - pass 02.html` — the full pass-02 canvas: 34 phone frames, 15 annotation cards, Parts
  A / B / C with the provisional divider.
- `pass02.css` — pass-02 styles; imports `pixwagon-surfaces.css` (this directory's copy, not pass
  01's — see the note under "About the design files").
- `pixwagon-surfaces.css` — pass-02's own base styles (tokens, type, buttons, panels, chips, board
  cells, HUD, pack cards, ranks, annotation cards); imports `styles.css`.
- `styles.css` — the token layer this pass's base styles are built on.
- `render-pictures-02.js` — prototype picture/board renderer. Reference only.

## Notes for engineering

1. **Rename the offer label only.** `RollControl`'s `label="Fallback"` becomes `The single` and
   `label="Pair"` becomes `The pair`. `OfferChoice`'s wire values `'pair' | 'fallback'` stay —
   this is display copy, not a protocol change. Then scrub "fallback", "dice", "combo" and "roll a
   combo" from all player-facing strings.
2. **`DiceFace` (carried from pass 01, still uncommitted):** the compound face already stacks two
   `BlobDots` rows with an `h-px w-full bg-border` rule in `flex flex-col items-center` — this
   matches the intended design; confirm and close it out.
3. **`lastRejection` must carry the claiming player**, not just a reason string, or `03g`'s copy
   cannot be written.
4. **`cellSize` is no longer a hardcoded 20** — implement the three-step rule (Annotation 11) as a
   viewport-derived value, and never a fluid one.
5. **One definition of the seat maximum.** Use `playerColors.length` (6); remove the duplicate
   `MAX_SEATS`. ROADMAP Phase 4 already flags this.
6. **Proposed new components, not renames:** `BoardCompare` (side-by-side finished pictures with
   identity and rank) and `ConnectionPill` (three states, warning-not-danger, plus the offline
   variant Home needs). Both are labeled proposals on the canvas; `HudFrame`'s `connection` prop is
   untouched.
7. **Before the next design pass:** add the `PlacementEditor` card, resolve the two-brief conflict,
   then `pnpm design:build` → `pnpm design:check` → `/design-sync`. The sync is a snapshot, not a
   live view.
