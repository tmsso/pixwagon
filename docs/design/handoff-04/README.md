# Handoff: Pixwagon pass 04 — the play table, polished

Answers `docs/design/BRIEF-04.md`, section _For the Claude Design pass that
follows_. Drawn 2026-11-05 as a Design canvas in Claude, from the brief, the
tokens, the hatch patterns and the real pack rows. Like pass 03, it was **not**
run through `/design-sync`, so there is no Handoff-button bundle. This directory
is written by hand in the shape of `../handoff-03/`.

**The canvas:** <https://claude.ai/artifact/8RhpvVR9iY499UdF5Xgsk5>. It is private
to the owner until it is shared from its Share menu.

Pass 04 is engineering-led (D16). This pass polishes the **visuals** the brief
asks for. It does not reopen the gestures, the layout structure, or D16–D21.

## About the design files

- `source/` — the Design canvas itself:
  - `canvas.json` — layout and the sticky notes;
  - one `.dc.html` per artboard.

  They render only inside the Design canvas, because they load its runtime
  (`support.js`, which is not in the repo). They are committed so a later pass
  can edit the canvas instead of redrawing it.

- **There is no flat reference export** this time, unlike pass 03's
  `Pixwagon - pass 03.html`. Open the canvas link above to look at the design.

The source files are a **design in HTML, not code to lift.** Rebuild it in
`apps/web` with the real components and token classes. `Main.dc.html` holds a
small working sketch of the input model. It is a prototype of the feel, not the
engine. The real legality check stays the client-side `applyMove` dry run
(engineering note 1).

## Fidelity

- High fidelity: final layout, copy and states.
- Phone first at 390×844, plus 1440×900 for the wide frames.
- Current token values are used unchanged, with one proposal (below).
- Light theme only.

---

## What was implemented

| Artboard                  | What it shows                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Main` (interactive)      | The phone play table on the Tram, round 4 at 31 / 54, **playable**. Pick up a tray tile, hover or tap the board (the ghost anchors on a piece cell), Turn / Flip (they pivot on the anchor; a staged piece that no longer fits goes back to your hand), drop, then ✓ Place. The single paints with live contiguity, restarts a blob on a non-touching tap, and hands focus to the next blob on compound faces. |
| `States`                  | `04a` holding, ghost fits · `04b` doesn't fit · `04c` staged, lone-square warning (D20) · `04d` ready, ✓ Place 5 (D18) · `04e` single `1+2`, second blob (D21) · `04f` last squares (D17) · `04g` room, checking with the room · `04h` room, rejected                                                                                                                                                          |
| `Desktop`                 | 1440×900 room, landscape: a 64 px board in the main area, with the 340 px side panel holding the picture card, tray, action bar, players and shortcut legend                                                                                                                                                                                                                                                   |
| `HowToPlay`               | The three-step dialog over the play table, drawn with the real piece glyph and board renderer, plus the "Last squares" rule card                                                                                                                                                                                                                                                                               |
| `Home`                    | Wide Home: the play card and recent results on the left; on the right, the chosen pack's pictures as thumbnails and today's daily                                                                                                                                                                                                                                                                              |
| `Components`              | `PieceTile` states · `DiceFace` dots → connected runs · board looks (open, filled, filled light, ghost fits / doesn't, staged with anchor notch, painting, lone square, checking, rejected, show-where-it-fits, complete) · `ActionBar` disabled-with-reason and ready · the board-size rule worked for five viewports                                                                                         |
| `Table`, `Board`, `Piece` | The parts the frames are built from (`PlayTable` phone layout, `BoardCanvas`, `PieceGlyph`)                                                                                                                                                                                                                                                                                                                    |

### Looks, as specified on the canvas

- **Ghost, fits:** `accent` at 45% with a 2 px `accent` inset. There is a white
  corner notch on the anchor cell.
- **Ghost, doesn't fit:** a 2 px `danger` inset on every ghost cell. The
  blocked cells also carry a 60% `danger` diagonal hatch. Off-board cells are
  clipped.
- **Staged:** `accent` at 65% with a 2 px `accent-hover` inset and the anchor
  notch. **Painting** (the single) is the same look plus a centre dot, so painted
  squares and staged pieces can be told apart.
- **Filled (D19):** the picture's own palette colour, with a 45° hatch at 16%
  white. On light swatches (luma > 200, such as the Tram's windows) the hatch is
  7% ink. The hatch drops out when the picture is complete and in thumbnails
  under 8 px.
- **Lone square (D20):** a 3 px dotted ring on a `bg`-coloured inner halo.
  Only squares the move would **newly** strand are flagged. The Tram's pole is
  already a lone square from round 1 and is not flagged.
- **Checking (rooms):** `accent` at 35% with a vertical stripe. The tray dims
  to 55% and is inert.
- **Rejected:** `danger` at 35% with a `danger` inset.
- **Just placed:** a 160 ms scale pop, which is `none` under
  `prefers-reduced-motion`.
- **Tray tiles:** _held_ lifts 3 px with a 2 px `accent-hover` ring; _staged_
  is a dashed outline with an "on board" pill; _dimmed_ is `bg` with grey
  squares. Each tile is at least 52 px (60 px on desktop), above
  `--spacing-touch`.

### Token proposal (values only, no names changed)

- **Problem:** in the light theme, `warning` (`#e8853a`) on `cell-fillable`
  measures **1.9:1**, which is too faint for the lone-square ring.
- **What the canvas does:** it draws the ring in `signal-600` (`#c96a25`) on a
  `bg` halo, which measures **3.5:1**.
- **Proposal:** set `semanticLight.warning` to `palette['signal-600']`.
- **Status:** this is the owner's call. It is not applied in `tokens.ts` here.

---

## What was NOT implemented

- **Dark mode.** No frame shows `semanticDark`, which is the same gap as passes
  02 and 03.
- **Tablet portrait** is not drawn. Per the brief it is the phone layout with
  larger cells (58 px for the Tram at 768×1024, see the board-size table on
  `Components`).
- **Gestures with no visual surface are not prototyped:** drag-to-paint, the
  touch ghost floating two cells above the finger, right-click, wheel and
  keyboard. `Main` does tap, click and hover only. The Desktop frame's legend
  shows the bindings.
- **"Show where it fits" (D20)** appears as a look on `Components` only. It
  has no settings surface.
- **Picture-complete beat and the result card** are not redrawn. The
  `complete` swatch shows the end state of the hatch fade.
- **The phone picture peek** (opened by tapping the 40 px thumbnail) is not
  drawn.
- **The "done for this round" waiting line and "Move on without …"** are not
  redrawn. Pass 03's `12a` / `12e` copy and look carry over.
- **No component code and no design-system card changes.** Engineering note 10
  regenerates the cards when the components exist.
