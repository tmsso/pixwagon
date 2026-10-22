# Handoff: Pixwagon pass 03 — rooms as built + Phase 6

Answers `docs/design/BRIEF-03.md`. Drawn 2026-10-22 as a Design canvas in Claude
(the in-Claude successor to standalone Claude Design), not through the
`/design-sync` → Claude Design → Handoff-button loop the brief assumed. Two
consequences, both deliberate:

- **It was designed from the source, not from the synced cards.** The brief's
  prerequisite 1 (re-upload the 19 cards) existed so Design had something to
  bind to. This pass read the components, tokens, hatch patterns, pack rows
  and the live room screens directly, and quotes live copy as its baseline.
- **There is no Handoff-button bundle.** This directory is written by hand in
  the same shape as `../handoff-02/`.

Pass 01 (`../handoff/`) and pass 02 (`../handoff-02/`) stay where they are.

## About the design files

- `Pixwagon - pass 03.html` — **the reference.** One canvas, one file: 36 phone
  frames, two component specs, the annotation cards, laid out at their canvas
  positions. Open it and pan. It needs only `pass03.css` beside it (and Google
  Fonts, if online).
- `pass03.css` — the frames' styles. Token values copied unchanged from
  `../handoff-02/styles.css`; component classes carried over from pass 02 so
  the two canvases read as one; pass-03 additions are marked in the file.
- `source/` — the Design canvas itself: `canvas.json` (layout, annotation
  text) and one `.dc.html` per artboard, plus `Pic.dc.html`, the helper that
  draws pack pictures from the real row strings. These render only inside the
  Design canvas (they load its runtime, `support.js`, which is not in the repo).
  They are here so a later pass can edit the canvas rather than redraw it; the
  flat reference above is generated from them.

Like pass 02's, the reference is a **design in HTML, not code to lift.**
Rebuild it in `apps/web` with the existing components and token classes.

## Fidelity

High-fidelity: final layout, copy and states, phone-first at 390×844, current
token values unchanged. No token renamed, added or revalued. Light theme only
(see "What was NOT implemented").

## Baseline

Drawn against `main` as of 2026-10-22 afternoon, then reconciled with the
Phase 6/7 stack merged that evening (#38–#46): the waiting-room settings
(`RoomSettings.tsx`), "Picture N of M" and "Round N of M" in `HudFrame`,
`PlayerChip`'s `completion`, the shipped `BoardCompare`, Home's daily and
history. Where the brief and the build disagree on anything other than D1–D10,
this pass wins (BRIEF-03 Part B).

---

## What was implemented

### Part A — the rooms as built (reconcile)

| Frame | State |
| --- | --- |
| `02a` `02b` | `/lobby` front door: name, join by code, create · not a room code |
| `02f` | `/r/CODE` from a link with no name yet — explains the game in one line |
| `02c` `02d` `02e` | waiting room: host 1 of 6 · a guest's view 3 of 6 · host, full |
| `02g1` `02g2` `02g3` | can't join: room full · newer version · open in another tab (D6) |
| `12h` (×2) | joining before the room answers · joining mid-game, getting your board |
| `12b` | you're still placing, others done |
| `12g` | checking with the room |
| `12a` | done for this round, waiting for the others |
| `03g` | rejection in a room (D1 copy) |
| `12c` | you're reconnecting, another player away |
| `12e` (×2) | host moves on after 30 s · the skipped player's next round |
| `12f` (×2) | your picture is complete: one-picture session · next picture waits for the room (D8) |
| `13d` | game over, one-picture session (the fallback) |
| `14` | crash screen |
| PlayerChip | `status` spec (proposal) |

### Part B — Phase 6

| Frame | State |
| --- | --- |
| `02h` (×2) | host's "This game" sheet: same board / Transportation · own board / Garden |
| `02i` | a guest sees the host's change, live |
| `01d` `06a` | solo pack choice: Home's Solo carries its pack · the picker plays and remembers |
| `12d` | own board: opponents as completion only (D9) |
| `12i` (×2) | picture 2 begins: after a finished picture · own board, after an unfinished one |
| `13a` (×2) | room results: same board · own board |
| `13b` | a tie, and a player who left mid-game |
| `13c` (×3) | rematch: a guest on the results · host back in the room · guest back in the room (D10) |
| BoardCompare | component spec (revises the shipped one) |

### Annotations

01–20 are untouched as addresses. **18, 19, 20 are marked superseded on the
canvas**, by 22, by 21 + 24, and by 28 + 29. New:

**21** waiting, under simultaneous rounds · **22** six seats, two to start, one
definition · **23** host powers: helpful, never punitive · **24** away vs left ·
**25** picture cycling and the round budget · **26** can't-join states, and why
the version one doesn't say "reload" · **27** a shared link is the front door ·
**28** BoardCompare, finalised · **29** no ConnectionPill · **30** results:
finished pictures first · **31** solo picks its pack on Home · **32** rematch is a
return, not a restart · **33** PlayerChip status (proposal) · **34** checking with
the room keeps the sheet up.

---

## What was NOT implemented

- **Dark mode.** `semanticDark` exists in `tokens.ts`; no frame shows it — same
  gap as pass 02.
- **Tablet and desktop layouts.** Only BoardCompare's cell steps speak to
  larger screens.
- **The repo-side prerequisites in BRIEF-03** (upload the 19 cards, attach the
  pass 02 canvas) were not done and are no longer needed for this pass — see the
  top of this file. They still apply to any future pass run through
  `/design-sync`.
- **Home's local history panel (Phase 7b)** is not redrawn; `01d` shows only
  the Play panel it changes.
- **The daily puzzle's own screens** — out of this brief's scope.
- **No component code.** `PlayerChip.status` and the BoardCompare revision are
  specified, not built, so no design-system card changed in this PR.

---

## Notes for engineering

Each item says what to change relative to `main` (2026-10-22, `5bd2a24`).

1. **"Start round" → "Start game"** (`02c`, `02e`). The host presses it once per
   game (D2); "round" was wrong once rounds advanced by themselves.
2. **Guests get no Start button** (`02d`, `02i`, `13c`): a `notice`-style line,
   "Alex starts the game when everyone's here." Build it from `Panel` (a
   one-line, non-interactive status); there is no new component.
3. **"This game" is a sheet** for the host (`02h`): the mode switch, its one-line
   explanation, and the pack list as `PackCard` radios, plus Done. The waiting
   room shows a one-line summary with Change. The own-board line changes to
   "Each of you gets a different picture from the pack. Same offers for
   everyone; boards side by side at the end." Guests see the summary only, plus
   one line naming what the host changed (`02i`).
4. **Skip copy** (`12e`): "Skip waiting players" → "Move on without Jo" (names
   from the existing `waitingLine` logic; "… without Jo and Kim" for two). Under
   it: "Jo keeps their board and plays the next round. Only you see this." The
   skipped player's next round shows "The room moved on to a new round. Your
   board is just as you left it." until their first action.
5. **`12g` holds the sheet.** After commit, keep the `PlacementEditor` sheet
   mounted at 55% opacity with every control disabled and the commit reading
   "Placing…", until `fill-accepted`/`fill-rejected`. Today the sheet closes on
   commit and the offers dim, which moves the board 76 px mid-wait (pass 02
   Annotation 12's rule). Status copy unchanged: "Checking with the room…".
6. **`PlayerChip` gains `status`** — `'placing' | 'done' | 'finished' | 'away'`,
   each a word plus an outline glyph (path data in `source/A7-PlayerChip.dc.html`).
   `connected={false}` renders `away`. `completion` stays, as a percentage, with
   a small bar beside it. Derive `placing`/`done` from `snapshot.acted` and
   `waitingOn`; `finished` from `isComplete(board)`. Give the players row a
   two-row minimum height for the whole game so a changing tag never moves the
   board.
7. **`waitingLine` grows a tail** (`12a`): "Waiting for Jo and Ravi — the next
   round starts by itself."
8. **`HudFrame`'s picture marker** becomes three small squares plus "2 of 3",
   with "Picture 2 of 3" kept as its accessible name — the full phrase doesn't
   fit beside the code, the round and the pill at 390 px.
9. **`12i`'s finished-picture strip**: on a stage change, show the previous
   picture above the new board in its own palette (`PicturePreview`) with
   "Complete · 100 points" or "Unfinished · scores nothing", until the
   player's first action on the new picture. The client has the previous
   boards in `snapshot.history`.
10. **`12f`** replaces the disabled offers with the completed picture's preview and
    "Picture 1 of 3 complete · Tram · 100 points", then "Picture 2 starts for
    everyone when Sam and Jo are done with this one." (one-picture session:
    "The results open when they're done.").
11. **`BoardCompare` revision** (`13a`–`13c`, spec on the canvas): pictures in
    aligned columns, a rank/name/totals column, "✓ done" / "unfinished" under
    each cell (own board adds the picture name), "joined later" for a `null`
    board. Rank text "1st · tied". `BoardCompareEntry` already carries
    everything; add the picture names for the column headers. Update its card
    in `scripts/design-system/cards.tsx`, then `pnpm design:build` →
    `pnpm design:check` → re-sync.
12. **Results headline** (`13a`, `13b`): "Jo wins" / "You win" / "It's a tie"
    above the comparison; Rematch (host) and Leave room. Ranking rule unchanged:
    pictures finished, then squares, then seat.
13. **Rematch, guest side** (`13c`): "Alex can start a rematch. Stay here and
    you're in." After the host presses it, the waiting room shows a one-line
    notice at the top ("Rematch — same room, new offers…").
14. **Can't-join screens** (`02g1`–`02g3`) share one layout: icon, room code,
    headline, the existing copy, one button at the bottom. `02g2` shows a static
    picture of the update banner so the player recognises it on Home.
15. **`02f`**: "Join the game", one line explaining it, a real pack picture, the
    name field labelled "What should the others call you?", and "No sign-up.
    Your name is only used in this room."
16. **`12h`** mirrors the layout that comes next — the waiting room's code and
    panel outlines, or `HudFrame` with a board-sized placeholder — and shows
    nothing but the background under 400 ms (Annotation 17).
17. **Solo pack choice** (`01d`, `06a`): the Solo button carries "Garden · 3
    pictures" with a Change button beside it; the picker's primary button is
    "Play Garden", which plays and remembers. This replaces Home's "Solo plays
    Garden. Change" panel. Daily unchanged.
18. **The `02c` code-typed hint** (Annotation 27): a player alone in a room they
    reached by typing a code sees "Expected friends here? Check the code with
    whoever sent it." Needs the lobby to pass "arrived by code" through
    navigation state.
19. **No ConnectionPill** (Annotation 29). Pass 02 note 6's second proposal is
    withdrawn.

## Tokens, assets

Tokens: unchanged, as listed in `../handoff-02/README.md`. Assets: none. Every
picture is drawn from `packages/packs/data/{transportation,garden}.json`; no
pixel art was invented. Icons are original outline SVGs inline in the frames
(1.7 px stroke, square caps, `currentColor`, pass 02's style): link, tick,
three dots (placing), four squares (finished), broken link (away), seats,
download, two windows, arrow, refresh.
