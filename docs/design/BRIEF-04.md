# Design brief and handoff — Pixwagon, pass 04 (direct-manipulation play table)

**Drafted 2026-11-05**, at the start of the redesign batch (`ROADMAP.md`, "Pass 04").
This pass is **engineering-led** (owner decision D16, 2026-11-05). This document is
the contract the batch's PRs are checked against. It is also the brief for a later
Claude Design polish pass. Unlike passes 02 and 03, the build comes **first** here:
the interaction model was the owner's complaint, and it is easier to judge in the
hand than on a canvas. Claude Design is then asked to polish the visuals of what
exists, not to reopen the interaction.

Where this brief and pass 02 or pass 03 disagree, this brief wins. The overridden
annotations are listed under _What this pass replaces_. Everything not listed
stays authoritative: pass 02 Parts A and B, and pass 03's room surfaces.

---

## Why — what the owner found, and what was verified

The owner played the live build (2026-11-05) and reported four things:

- The game is counterintuitive to play.
- In a desktop browser it looks bare.
- It leans on large "Place this and that" buttons.
- A move that should fit, "two 1×1 squares into two 1×1 holes", was refused.

Each was checked against the code, the live site at 390 px and 1440 px, and a
reproduction:

1. **The "two 1×1" refusal is a presentation bug, not a rules bug.** A single of
   `2` is one connected 2-square group (`docs/mechanics-correction.md`). The UI
   contradicted that in three ways:
   - `DiceFace` drew `2` as `••`, two separate dots, which reads as two 1×1
     pieces.
   - The editor let you tap two holes that don't touch, then enabled "Place 2
     squares", and the referee rejected the move as `blob-not-contiguous`.
   - On compound faces (`1+2`, `1+3`) finishing the first blob never moved on to
     the second, so the next tap was silently dropped.
2. **Pieces landed away from the tap.** The tapped cell became the piece's
   bounding-box top-left. For S, T and L shapes in some orientations, that cell
   is not part of the piece.
3. **Placing took four or more steps behind a modal sheet:** choose an offer, a
   sheet covers the board, tap the board once per piece, then press Place.
   - On a 390 px phone the sheet clipped the Turn and Flip labels under the
     commit row.
   - On desktop a 12×8 board sat at 40 px in an empty page, and a full-width
     sheet with a scrim covered it.
4. **There is no "How to play".** A first-time player meets "The pair" and "The
   single" with no explanation.

A rules simulation found one more problem. It used a heuristic bot, 6 pictures ×
60 seeds per variant. The bot plays better than a person, so the real numbers
are worse.

- **Completion:** 91% of pictures are completed within the round budget.
- **The dead tail:** a median of 4 rounds (10 at the 90th percentile) are spent
  waiting for a `1` to close the last one or two stranded squares. Scoring is
  all-or-nothing, so a 98%-filled picture scores 0.
- **Loose squares do not fix it:** letting `2` mean two loose squares only reaches
  93%.
- **"Last squares" does:** a single may fill all the squares left once fewer
  remain than its total. That reaches 100%, a median of 10 rounds, and removes
  the dead tail.

That is decision D17 below.

---

## Decisions this pass is built on (owner, 2026-11-05 — all defaults agreed)

- **D16:** Pass 02/03's in-game interaction is superseded: the sheet, the scrim,
  the fixed 284 px height and the three cell steps. This brief replaces it. Claude
  Design polishes the visuals afterwards and does not reopen the interaction.
- **D17 — the "last squares" rule.** When fewer fillable squares remain than the
  single's total, the single may fill all of them. Its blob split no longer
  applies; each remaining group of squares counts as one blob.
  - Rooms break ties on completed pictures by **fewer rounds used**.
  - The rule changes the rules engine, the referee and the protocol (version 4).
    It ships as its own PR, last in the chain.
  - The worker deploy waits for the owner's go.
- **D18:** A move is confirmed with a **compact ✓ Place**, the same in solo and
  rooms. Enter and a double-click on the last staged piece also confirm. There is
  no instant placement: in a room a sent move is final.
- **D19:** Filled squares show the **picture's own colours**, with the hatch kept
  as a low-contrast texture, so colour is never the only signal (CLAUDE.md §6).
- **D20 — hints.**
  - The ghost always shows "fits" or "doesn't fit".
  - A marker warns when a staged move would leave a **lone square**: one fillable
    cell with no fillable neighbour.
  - An optional "Show where it fits" setting starts **off**.
- **D21:** A `2` stays one connected group. Die faces are drawn as connected
  shapes.

---

## The model: pick up, aim, drop, confirm

One mental model on every device. **The offers are pieces in a tray. You pick
one up, aim it at the board, drop it, and confirm.**

- **The tray holds every piece of both offers, always visible** (Annotation 13
  stands). "The pair" shows two piece tiles. "The single" shows one tile per blob,
  each drawn as a connected run of squares (`▪▪`, `▪▪▪`), never as dots.
- **The choice between the offers is implicit.** Picking up a piece from one offer
  makes that offer the round's choice, and the other offer's tiles dim.
  - Picking up a tile from the dimmed offer switches the choice and returns
    anything already staged to the tray.
  - No "Switch" control is needed, and there is no separate choose step.
- **Holding a piece** shows a ghost on the board. Its colour says whether the
  piece fits where it is.
- **The anchor is a piece cell.** The cell under the pointer (or the tapped cell)
  is always one of the piece's own cells: the grabbed cell, or by default the
  piece's first cell in reading order. Turning and flipping pivot on the anchor,
  so the ghost never jumps away from the pointer.
- **Dropping stages the piece.** It is not sent yet. A staged piece can be picked
  up again, moved, turned or flipped.
- **✓ Place** sends the whole move once everything is staged and legal.
  - Legality is decided by running the rules engine's own check (`applyMove`) on
    the client, not by counting squares.
  - The button is disabled, with a one-line reason, until then.

### The single (painting)

- Selecting a single tile enters painting mode for its blob.
- **Click or tap** a fillable cell to add it to the active blob. **Drag** across
  cells to paint a path.
- **A cell that doesn't touch the active blob restarts it** at that cell. It is
  not silently refused: a tap always does something visible.
- **Tapping a painted cell removes it.** If that splits the blob, the larger part
  stays.
- **A full blob hands focus to the next unfilled blob** on compound faces. A
  blob's squares may touch another blob's (the rules allow it).
- **"Last squares" (D17):** when the board has fewer fillable cells than the face
  totals, the tray says _"Last squares — the single fills them all"_. One tap on
  the single tile stages every remaining square.

### Gestures

| Action                 | Mouse                                                                       | Touch                                                                                  | Keyboard                                 |
| ---------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------- |
| Pick up a piece        | Click a tray tile, or start dragging it                                     | Tap a tray tile, or drag it out                                                        | Tab to a tile, Enter or Space · keys 1–4 |
| Aim                    | Move the pointer over the board; the ghost follows                          | Drag on the board; the ghost floats **two cells above the finger** so it stays visible | Arrow keys move the ghost                |
| Drop (stage)           | Click a cell · release a drag                                               | Tap a cell (the ghost anchors exactly there) · lift the finger after a drag            | Enter or Space                           |
| Turn 90°               | **Right-click** · mouse wheel · `R`                                         | **Tap the held or staged piece** · Turn button                                         | `R`                                      |
| Flip                   | Shift + right-click · `F`                                                   | Flip button                                                                            | `F`                                      |
| Pick a staged piece up | Click it (or drag it)                                                       | Drag it · or tap its tray tile                                                         | Tab to its tile                          |
| Put back / undo        | `Esc` drops what is held back to the tray · Undo takes back the last staged | Undo button                                                                            | `Esc` · `Backspace`                      |
| Confirm                | ✓ Place · double-click the last staged piece                                | ✓ Place                                                                                | `Enter` with nothing held                |

- **Right-click never opens the browser menu** on the board or the tray.
- **The board sets `touch-action: none`**, so dragging a piece never scrolls or
  zooms the page.
- **Hover is an enhancement.** Every mouse-only gesture has a touch and a keyboard
  equivalent, and the Turn and Flip buttons are always visible.

### Feedback on the board

| State               | Look                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------- |
| Ghost, fits         | `accent` at 45%, solid 2 px `accent` outline                                             |
| Ghost, doesn't fit  | `danger` outline with a diagonal hatch on the blocked cells; off-board cells are clipped |
| Staged              | `accent` at 65%, solid outline, a small corner notch on the anchor cell                  |
| Lone-square warning | a dotted `warning` ring on the cell that would be left alone (D20)                       |
| Filled              | the picture's own palette colour, hatch texture at low contrast (D19)                    |
| Just placed         | a 160 ms scale pop (`duration.normal`); none under reduced motion                        |
| Picture complete    | the hatch fades and the picture shows in full colour for a beat, then the result card    |

---

## Layouts

Three arrangements of one set of parts: the **board**, the **tray** (offers plus an
action bar), the **picture card** (target thumbnail, name, progress) and, in rooms,
the **players**.

### Phone, portrait (the base design, 390 × 844)

```
┌──────────────────────────────┐
│ SOLO · Round 4 of 22     (?) │  header: code, round, help
│ ▓▓▓▓▓▓▓▓░░░░░░ 31/54  [pic]  │  progress bar + target thumbnail
│ (chips, rooms only)          │
│                              │
│        ┌──────────────┐      │
│        │    board     │      │  largest whole-pixel cell that fits
│        └──────────────┘      │
│ status line (one line)       │
├──────────────────────────────┤
│ THE PAIR        │ THE SINGLE │  tray: tiles at ≥ 2.75rem
│ [▪▪▪] [▪▪ ]     │  [▪▪]      │
│         [▪  ]   │            │
│ [Undo] [Turn] [Flip] [✓ Place 6] │  action bar, thumb reach
└──────────────────────────────┘
```

- **Nothing covers the board.** The tray is part of the layout, not an overlay.
- **The tray height is fixed**, so the board never moves when a piece is picked
  up or staged.
- **The action bar is always visible.** Turn, Flip and Undo are disabled when they
  can't act. ✓ Place shows its count and is disabled until the move is legal.

### Tablet and desktop, landscape (≥ 900 px wide and wider than tall)

```
┌───────────────────────────────────────────────┬──────────────────────┐
│ SOLO · Round 4 of 22                       (?)│  [ target picture ]  │
│                                               │  Tram · 31 / 54      │
│                                               │  ▓▓▓▓▓▓▓▓░░░░░       │
│            ┌─────────────────────┐            ├──────────────────────┤
│            │                     │            │  THE PAIR            │
│            │        board        │            │  [▪▪▪]  [▪▪ ]        │
│            │                     │            │          [▪ ]        │
│            └─────────────────────┘            │  THE SINGLE  [▪▪]    │
│         status line                           │  [Undo][Turn][Flip]  │
│                                               │  [   ✓ Place 6    ]  │
│                                               ├──────────────────────┤
│                                               │  players (rooms)     │
│                                               │  keys: R turn · F …  │
└───────────────────────────────────────────────┴──────────────────────┘
```

- **The side panel is 340 px.** The board fills the rest.
- **A shortcut legend** sits at the foot of the panel on devices with a fine
  pointer (`@media (pointer: fine)`).

### Tablet, portrait

The phone layout with larger cells.

### Board size (replaces Annotation 11)

The cell size is the **largest whole number of CSS pixels** for which the board
fits both the available width and the available height, clamped to **16–64 px**.
It stays a whole number so cells keep crisp edges at any device pixel ratio. That
was Annotation 11's reason, and it still holds. The three fixed steps
(20/28/40) are retired: they left a desktop board at 480 × 320 in a 1440 × 900
window.

---

## Richer surfaces

- **The picture card.** It shows the target picture in its own colours, its name
  and a progress bar ("31 / 54 squares"). On phones it is a 40 px thumbnail in
  the header that opens a larger peek on tap.
- **How to play.** Three illustrated steps:
  1. Pick a piece from the pair or the single.
  2. Drop it on the picture. Turn and flip as you like.
  3. Fill every square: a finished picture scores and an unfinished one doesn't.

  The rule cards carry the "last squares" line. It opens once on the first visit,
  then from a **?** button in every game header and from Home. It is a `Dialog`
  and is dismissible, and the steps are drawn with the real `PieceGlyph` and
  board cells.

- **Home on wide screens.** It becomes a two-column layout:
  - the play card on one side;
  - on the other, the chosen pack's pictures as thumbnails, today's daily (with
    "✓ done in N rounds"), and the last few results from local history.

  Phone Home is unchanged apart from a How-to-play link.

---

## Rooms

The same play table, with the room parts placed in it.

- **Players.**
  - Phone: the chips row above the board, as now (pass 03 note 6: rows reserved
    up front).
  - Landscape: chips in the side panel.
- **Waiting for the referee** (replaces pass 03 note 5's held sheet). The tray
  dims to 55% and is inert. The staged pieces stay on the board as "checking",
  and the status line says "Checking with the room…".
- **Done for this round:** the tray is replaced by the waiting line and, for the
  host after 30 s, "Move on without …" (pass 03 note 4 copy unchanged).
- **The finished-picture card** (`12f`) and the previous-picture strip (`12i`)
  keep their copy and move into the tray area or the side panel.
- **Rejection:** the staged pieces flash `invalid`, return to the tray, and the
  status line says "Those squares didn't fit — try another spot."

---

## What this pass replaces

| Pass / note                                                          | Replaced by                                                                  |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Pass 02 Annotation 09 (on-board placement gesture: origin-cell taps) | _The model_ and _Gestures_ above (anchor is a piece cell; drag; right-click) |
| Pass 02 Annotation 11 (cell steps 20/28/40)                          | _Board size_ above                                                           |
| Pass 02 Annotation 12 (footer stack → 284 px sheet over a scrim)     | _Layouts_ above: tray in the layout, nothing covers the board                |
| Pass 02 Surface 03 sheet spec, Surface 07 composition sheet          | The tray and action bar                                                      |
| Pass 02 "Contiguity is checked at commit, never per tap"             | Live contiguity; ✓ Place gated on the rules engine's own legality check      |
| Pass 02 `03h` (Pass button only when no legal move)                  | Unchanged rule; the Pass button sits in the action bar's place               |
| Pass 03 note 5 (held, inert sheet while the referee rules)           | The tray dims and the staged pieces show "checking"                          |
| `DiceFace` drawing a blob as separated dots                          | Connected runs                                                               |
| Player hatch colour on one's own filled cells                        | The picture's palette colour with a low-contrast hatch (D19)                 |

Kept: Annotation 13 (both offers always shown, pair first) · 14 (composition copy,
not debug output) · 15 (all-or-nothing scoring copy) · 16 (offline is a state) ·
17 (reduced motion) · every pass 03 room surface not named above.

---

## Components

| Component                        | Status   | Notes                                                                                                                      |
| -------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------- |
| `PlayTable`                      | new      | The responsive layout (board, tray, picture card, players). Replaces `HudFrame`'s `sheet`/`controls` slots in game screens |
| `OfferTray`                      | new      | Both offers as tiles + the action bar. Replaces `RollControl` + `PlacementEditor`                                          |
| `PieceTile`                      | new      | One piece or blob: idle / held / staged / dimmed / disabled                                                                |
| `ActionBar`                      | new      | Undo · Turn · Flip · ✓ Place (or Pass)                                                                                     |
| `ProgressMeter`                  | new      | "31 / 54" bar                                                                                                              |
| `HowToPlay`                      | new      | The three-step dialog                                                                                                      |
| `BoardCanvas`                    | reworked | Pointer layer (hover, drag, right-click, wheel), ghost and staged states, palette fill                                     |
| `DiceFace`                       | reworked | Connected runs                                                                                                             |
| `PlacementEditor`, `RollControl` | retired  | Their design-system cards are replaced by `OfferTray`'s                                                                    |

---

## Engineering notes (the batch's work list)

1. **Single fix:** connected die faces, live contiguity, auto-advance on compound
   faces, ✓ Place gated on the client-side `applyMove` dry run (pair too). Test
   with the 5×3 two-hole board.
2. **Anchor:** pending pieces carry an anchor cell index. `origin = anchor cell −
anchor offset` is computed on the client. The wire format (`PiecePlacement`)
   is unchanged.
3. **Input model:** a pure module (hold, aim, stage, pick up, turn, flip, undo, put
   back), unit-tested without a DOM.
4. **Pointer layer** on `BoardCanvas`, built on pointer events (one API for mouse,
   touch and pen), with `touch-action: none` and the context menu suppressed.
5. **`PlayTable` + `OfferTray`** for solo and daily.
6. **Rooms** on the same parts.
7. **Palette fill, picture card, progress, pop and complete animations.**
8. **How to play** and the wide Home.
9. **D17 "last squares"** in `game-core` + referee + protocol 4 + rounds-used
   tiebreak, as its own PR.
10. **Design-system cards** regenerated (new components, retired ones removed).

## Constraints that carry over

- Phone first.
- Offline solo and daily.
- Original art and copy only.
- No accounts.
- Reduced motion is honoured through the duration tokens.
- Token names are fixed.
- Component names match the code.
- Touch targets ≥ 2.75rem.
- Colour is never the only signal.
- Icon-only controls carry a label.

## For the Claude Design pass that follows

Bring the polish back as `docs/design/handoff-04/`, with the usual "What was
implemented / What was not" split. In scope:

- the tray tiles;
- the ghost and staged looks;
- the picture card;
- the How-to-play illustrations;
- the wide Home;
- token values.

The gestures, the layouts' structure and the D16–D21 decisions are out of scope.
Run `/design-sync` first, so Design sees the new cards.
