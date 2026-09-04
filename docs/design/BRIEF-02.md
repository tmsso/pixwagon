# Claude Design brief — Pixwagon, pass 02 (mechanic-accurate + forward-design)

**This supersedes `docs/design/BRIEF.md`.** That brief describes a "dice/combo"
mechanic the game no longer has (see _The mechanic_ below). `docs/design/README.md`
says this directory is safe to hand-edit, and a brief is an _instruction_, not a
historical source — a stale instruction is actively harmful. Before this pass is
handed to Claude Design, resolve the repo so **exactly one brief is live**:
either replace `BRIEF.md`'s body with a pointer here, or keep it with a
"superseded by `BRIEF-02.md`" banner at the top. Two briefs disagreeing about the
core mechanic is the exact hazard that paused the Phase 0.5 design pass
(`docs/mechanics-correction.md`).

---

## Repo-side prerequisites — do these before sending this to Claude Design

1. **One live brief.** As above.
2. **`PlacementEditor` needs a design-system card.** Phase 2 shipped a
   `PlacementEditor` component (piece/blob composition — the heart of this pass)
   that has **no preview card**, so `/design-sync` gives Claude Design nothing to
   bind to and it will invent a name for it — the failure "names match the code
   one-for-one" exists to prevent. Add a card to `scripts/design-system/cards.tsx`
   (variants: pair mid-composition · pair fully placed · fallback blobs — at
   least two visibly distinct, or `pnpm design:check` flags identical variants),
   then `pnpm design:build` → `pnpm design:check` → `/design-sync`.
3. **Re-sync.** The `dice-face`, `roll-control` and `piece-glyph` cards already
   exist and already reflect the Phase 1 rework — just confirm the sync is
   current after step 2 regenerates the bundle.
4. Optionally, add a **Phase 2.5 "design interlude"** entry to `ROADMAP.md`,
   mirroring Phase 0.5's shape (numbered steps + a bold **Accept:** line), so
   this pass leaves the same trail that one did.

---

## The product in a paragraph

A browser-based, installable-PWA, real-time roll-and-fill **pixel-placement**
game. Players share a room code; each round the referee issues a fair pair of
polyomino pieces (take both or take neither) plus an independent fallback-die
value, and players place shapes to complete a pixel picture. It should feel
quick, tactile and friendly — a game you pull out at a table with two other
people, on a phone, for ten minutes. Not a competitive esport, not a puzzle app
that wants your email address.

**Four modes:** same board (everyone fills the identical picture from the same
offers), own board (parallel pictures, compared at the end), solo, and a daily
puzzle. Solo and daily work offline.

**No accounts.** Identity is a display name plus a room code. Nothing on screen
should imply a profile, a login, or a persistent history.

## The mechanic — stated in full, this is authoritative

Each round, from that round's seed, the referee issues **two offers, both
revealed up front**:

- **The pair** — two polyomino pieces from a fixed shape library. Placed
  **together or not at all**: one atomic move, both pieces. The player rotates
  and mirrors each piece freely at placement time; the offer fixes the shapes,
  not their orientation. Each piece must land entirely on unfilled,
  currently-fillable cells.
- **The fallback** — one value of a custom six-sided die:
  `1 · 2 · 3 · 1+2 · 2+2 · 1+3`. A bare number is **one contiguous blob** of that
  many cells. A compound value is **two independent contiguous blobs** of those
  sizes, placed anywhere among the player's remaining fillable cells — they need
  not touch each other or the pair. A compound value is **both blobs or
  neither** — no partial placement.

**The player chooses one offer, freely, every round — the pair or the fallback.**
This is a standing strategic "take a lot or take a little" decision each turn,
**not** an error-recovery path for when the pair does not fit. The current
build's **"Fallback" label reads as error recovery and is wrong** — please
propose player-facing names for _both_ offers that frame them as two deliberate
choices.

Both offers are shown before the player decides — nothing is gated behind
declining — because in same-board mode a decline-to-reveal would leak the
fallback value to slower-deciding players purely by reaction speed.

**Scoring:** a fixed value per **fully completed** picture, zero for an
incomplete one. No partial credit. A board can permanently strand a few cells
nothing fits — full completion is not guaranteed every game.

**Session end:** a session cycles through its pack's pictures and ends on a
precomputed round budget, not on a single win/lose board.

Everything a physical roll-and-write does with a pencil, this does with placed
shapes. **Do not name, or visually echo, any existing commercial board game** in
the output — internal repo docs reference an influence by name; the shipped
design and any handoff text must not.

---

## What Phase 2 already shipped — the baseline to improve, not a blank page

Home, Game, PackPicker and Results are **built as real routes** now. The synced
card index is the source of component truth (18 cards: `Button` · `IconButton` ·
`Panel` · `Dialog` · `RoomCodeInput` · `PlayerChip` · `DiceFace` · `RollControl`
· `PieceGlyph` · `PlacementEditor`† · `BoardCell` · `BoardCanvas` ·
`PicturePreview` · `PackCard` · `HudFrame`, plus the `Colors` / `Type` /
`Spacing` / `Player colours` foundations). †after prerequisite 2.

**The current Game-screen turn flow** — Phase 2 invented this: no annotation ever
specified the on-board gesture, so it was derived from `BoardCell`'s `candidate`
state plus the disabled-not-hidden rule (Annotations 01 and 04):

1. `RollControl` shows two offer cards side by side — the pair (two `PieceGlyph`s)
   and the fallback (`DiceFace`). Player taps one to select it.
2. `PlacementEditor` appears: a radiogroup of the chosen offer's pieces/blobs,
   plus rotate / mirror / clear controls for the active pair piece.
3. Player taps a board cell to set the active piece's origin (blobs: taps toggle
   individual cells). Candidate cells highlight via `BoardCell.candidate`.
4. `RollControl` shows a commit button — "Place N squares" — enabled once the
   choice is fully composed, with Cancel beside it.
5. When neither offer has any legal placement, a "Pass the round" button appears
   (exact legality check, not a size heuristic).
6. A rejected commit shows `role="alert"` text and flips the board to
   `BoardCell.invalid`.

**Known weak points in that flow — please redesign, don't just re-skin:**

- **Rotate / mirror / clear are raw glyphs** (`⟳ ⇋ ×`) in `IconButton`s.
  Placeholder-grade, and used every single turn — they deserve real iconography
  and a considered layout.
- **`placed at (3, 5)` coordinate text** is debug output on a player-facing
  surface. Replace with something a player should actually see, or nothing.
- **Blob composition reads `2/3` and "blob 1" / "blob 2"** — engineer-facing.
  Needs player copy and a clearer "this blob still needs N cells" affordance.
- **Board cell size is hardcoded (`cellSize={20}`).** Annotation 03 demands crisp
  phone→desktop scaling and Phase 2 punted it. Specify the rule: integer scale
  steps, target cell size at 390 px vs. tablet vs. desktop, and how the board
  frames itself when the picture's grid does not divide the viewport evenly.
- **Vertical budget on 390×844 is unresolved.** Board + `RollControl` +
  `PlacementEditor` + pass button + rejection text can all be on screen at once,
  against Annotation 06 (primary action in the lower half, 2.75 rem targets).
  Resolve the stack explicitly — this is the layout question Phase 2 left open.
  Candidates to weigh: `PlacementEditor` as a sheet over the board; merging it
  into `RollControl`; collapsing the offer cards once one is chosen.

Use the **real transportation-pack pictures** for board mockups —
`docs/design/surfaces/render-pictures.js` already draws them. Do not invent pixel
art (`CLAUDE.md` §7).

---

## Part A — Corrective surfaces (authoritative output)

Refresh the existing six surfaces (`docs/design/surfaces/`) to the real mechanic.
Keep surfaces 01–06 numbered as they are; add new surfaces as **07+**.

- **Surface 03 · Game** and **Surface 04 · the offer/placement control** — the
  centre of this pass. Deliver the redesigned turn flow above: offer selection →
  piece/blob composition → on-board placement → commit → rejection/rollback →
  pass. States to cover: waiting for offer · offer shown · pair being composed
  (0 / 1 / 2 pieces placed) · fallback being composed · choice complete, ready to
  commit · awaiting referee (disabled, layout stable) · rejected / rolled back ·
  no legal move (pass) · round scoring.
- **New Surface 07 · Piece/blob composition** — `PlacementEditor` as its own
  surface, the way Surface 04 treats `RollControl`. Rotate / mirror / clear
  iconography and layout, active-piece indication, per-blob progress,
  undo-before-commit.
- **Surfaces 01, 02, 05, 06** — scrub every "dice" / "combo" / "roll a combo"
  reference from copy and state names; where a state was defined around the old
  mechanic, redefine it for pair / fallback. Otherwise these keep their Phase 0.5
  direction.

## Part B — Phase 3 PWA surfaces (authoritative output)

- **Install / add-to-home-screen** affordance — where it lives, how it reads on a
  game with no account, and its dismiss / never-again behaviour.
- **Offline & airplane-mode** states for Home, Game (solo), PackPicker, Results,
  building on Annotation 08 (offline is first-class, not an error). Ideally
  nothing alarming changes visually when a solo flow has no network.
- **"New version available"** prompt after a service-worker update.
- **Splash / first paint** while the shell boots from cache.

## Part C — Multiplayer surfaces (PROVISIONAL — put behind a clear divider on the canvas)

These get designed against `RoomState` and protocol shapes that **do not exist
yet** (Phases 4–6). This repo's own history is that designing against an unbuilt
model is what paused the last pass — so label this whole block **provisional** on
the canvas, divided from Parts A/B (which are authoritative), and treat it as a
starting point Phases 4–6 refine, not a frozen spec.

- **Lobby (Surface 02) in full** — join by code, create room, player list with
  host, mode selector, pack selector. **Room full is six seats** (`MAX_SEATS` /
  `playerColors.length`; the repo currently has two definitions of this and
  ROADMAP Phase 4 flags it — the number is 6). States: entering code · invalid
  code · waiting (1 player) · ready (2+) · full (6).
- **Game, networked** — the connection pill (`HudFrame` already has `online` /
  `connecting` / `offline`), presence (who is here, whose turn), a player
  disconnecting mid-round, and optimistic fill → server rollback in a
  multiplayer context (other players must never see the rejected fill).
- **Results, own-board** — per-player completed pictures side by side, ranking, a
  tie, someone left mid-game, and rematch with the same players and a fresh seed.
- New components for connection state / results comparison are **welcome as
  explicitly labeled proposals**. Do not silently rename or re-scope an existing
  card.

**Every surface that shows player identity — Parts A, B and C — carries the hatch
pattern as well as the hue** (`CLAUDE.md` §6, `apps/web/src/design/patterns.ts` /
`canvasPatterns.ts`). Forward-designed multiplayer is exactly where colour-only
identity creeps back in; the existing Annotation 02 only covered the original
surfaces.

---

## Annotations

The handoff is only as useful as its annotations, and the last pass's numbered
annotations are **cited by number in the code** (`GameScreen.tsx`,
`PlacementEditor.tsx`, `ROADMAP.md`). So:

- **Annotations 01–08 are stable addresses. Do not renumber or re-scope them.**
  Add new annotations as **09+**.
- Put annotations **on the canvas** (they travel with the handoff), numbered,
  each a short titled note.
- New annotations this pass should at least cover: the on-board placement gesture
  (finally specified, not inferred); the offer-naming decision; the board
  scaling rule; how the Game footer stack resolves on a small phone; PWA offline
  / first-paint expectations; and the provisional status of Part C.

## Constraints Claude Design must respect

- **Phone-first.** Design 390×844 first; larger screens are the adaptation.
- **Offline solo & daily.** No flow in them may depend on a connection indicator.
- **Original art & copy only.** Reuse the real pack pictures; invent no pixel
  art; reproduce no artwork, iconography or rulebook phrasing from any existing
  game, and name none.
- **No accounts.** No profile, avatar, settings-sync or login surface.
- **Reduced motion** is a real requirement, wired through duration tokens —
  anything that only works animated needs a static equivalent.
- **Tokens:** names in `apps/web/src/design/tokens.ts` are fixed; values are
  replaceable — proposing better values is welcome, renaming or inventing tokens
  is not.
- **Components:** names match the code one-for-one. New ones only as labeled
  proposals.

## After the pass

Bring the result back via the **Handoff button**. Ask Claude Design to include a
`docs/design/handoff/README.md` with the same **"What was implemented / What was
not implemented"** split the 2026-08-09 handoff used. Re-run `pnpm design:build`
+ `/design-sync` whenever a token or component shell changes afterward — the sync
is a snapshot, not a live view.
