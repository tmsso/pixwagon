# Claude Design brief — Pixwagon, pass 03 (rooms as built + Phase 6 forward-design)

**Drafted 2026-10-15. Answered 2026-10-22 by `handoff-03/`** (drawn as a Design
canvas in Claude, from the source; the prerequisites below were for the
`/design-sync` route and were not needed — see `handoff-03/README.md`). This brief **replaces Part C** of
`BRIEF-02.md` (the provisional multiplayer block). Parts A and B of pass 02 —
the solo game, the offer control, the placement sheet, the PWA surfaces — stay
authoritative and are **not** reopened here. Where this brief and pass 02's
Part C disagree, this brief wins; where it is silent, pass 02 Parts A/B hold.

Pass 02 designed multiplayer against a room model that did not exist yet and
said so on its canvas. Since then the room model was decided (D1–D3,
2026-09-16), built and deployed (Phases 4–5, live since 2026-10-08), and the
next phase's open questions were decided too (D6, D7). This pass does two
things with that:

1. **Part A — reconcile.** Bring pass 02's provisional room frames in line with
   what was decided, and give a real design to the room states that were built
   with no design at all.
2. **Part B — forward-design Phase 6.** Own-board mode, picture cycling, pack
   choice, the room results screen, rematch.

---

## Repo-side prerequisites — do these before sending this to Claude Design

1. **Re-sync the design system.** The bundle in `design-system/` last changed
   2026-10-08 (the `PlayerChip` away state, Phase 5). It was rebuilt and checked
   on 2026-10-15 — 19 cards, 0 blank, 0 thin, 0 with identical variants, no
   drift from `main` — but **not uploaded**: the upload needs a Claude Design
   login that the cloud session drafting this brief did not have. From an
   interactive Claude Code session on this repo: `/design-login` once, then
   `/design-sync` into the existing project (`.design-sync/config.json`). Per
   `.design-sync/NOTES.md` this is a full re-upload of `design-system/`, not a
   diff.
2. **Confirm Design sees 19 cards**, including `PlacementEditor` (pass 02 could
   not bind to it; it now has a card) and `PlayerChip` with an `away` variant.
3. **Attach pass 02's canvas** (`docs/design/handoff-02/Pixwagon - pass 02.html`
   and its three stylesheets) as the starting point. This pass edits that
   canvas's Part C; it does not start a new one.

---

## The product and the mechanic

Unchanged from `BRIEF-02.md` — read its _The product in a paragraph_ and _The
mechanic_ sections; they are authoritative. One addition since: the two offers
are now labelled **"The pair"** and **"The single"** in the shipped build
(pass 02 note 1), and the word "fallback" survives only in code and the wire
format.

---

## What is now settled — design to these, do not reopen them

These were provisional when pass 02 was drawn. They are owner decisions now;
reopening one is an owner-level change, not a design proposal.

- **D1 — "same board" means per-player copies of one picture.** Everyone gets
  the same picture and the same offers each round, and fills **their own
  copy**. Nobody claims cells from anyone else. Consequences for pass 02:
  - `12a` "your turn" is wrong — there are no turns. Reinterpret it as **"done
    for this round, waiting for others"**.
  - `03g`'s "Sam reached them first" cannot happen. The rejection copy is
    **"Those squares didn't fit — try another spot."** (same as solo).
  - Same-board and own-board differ **only** in which picture each player gets.
- **D2 — simultaneous rounds, no timer.** Every connected player acts (places
  or passes) at once; the round advances by itself when all have acted. The
  host does not press anything per round — only "Start" once. No visible
  countdown in v1.
- **D3 / Phase 6 — picture cycling.** A session plays through the pack's
  pictures; each picture gets a fresh round budget; the session ends when the
  pack is exhausted. (Phase 5 shipped one picture per session; Phase 6 adds the
  cycling.)
- **D6 — closing a tab will no longer make a ghost.** Decided, lands first in
  the next batch: a player who closes and reopens the app rejoins as themselves.
  Design can assume one chip per person. Because the identity is now shared by
  every tab of one browser, opening the room in a second tab takes the seat
  over and the first tab shows a terminal "open in another tab" state with a
  "Play here" button (decided 2026-10-22) — design that state alongside `02g`.
- **D7 — pack choice.** Garden ships now (tulip, watering can, mushroom) and is
  no longer "coming soon" anywhere. The host picks the pack in the waiting
  room; a solo player picks it before starting.
- **D8 — picture cycling is lockstep** (decided 2026-10-22). The whole room
  moves to the next picture together, once every player's current picture has
  resolved (completed, or out of rounds). A player who finishes early waits
  for the rest, exactly as at the end of a Phase 5 game. So in same-board mode
  everyone is always on the same picture, and "Picture 2 of 3" is one shared
  moment for the room.
- **D9 — own-board mid-game visibility: completion only** (decided
  2026-10-22). During a game a player sees each opponent's progress on their
  chip (how complete their picture is), never their board. Boards are shown
  side by side only on the results screen, in `BoardCompare`.
- **D10 — rematch is host-only and returns to the waiting room** (decided
  2026-10-22). Everyone still connected goes back to `/r/CODE` with the same
  mode and pack. The host may change either, then presses Start. Nobody
  rejoins.
- **Six seats, two to start.** `MAX_PLAYERS` is 6 (one per hue + hatch pair).
  Starting needs two players. Room codes are four characters from an alphabet
  with no `I`, `O`, `0` or `1` — pass 02's sample code `PIXW` can never be
  issued; use a code like `KM4T` in mockups.
- **The waiting room lives at the room's own URL, `/r/CODE`**, not at
  `/lobby`. `/lobby` is only "type a name, create or join". A copied link
  lands everyone in the same place.
- **Pass only when stuck.** "Pass the round" appears only when neither offer
  has any legal placement, in rooms exactly as in solo (decided 2026-10-08).
- **Away players keep their seat and their board.** A disconnected player's
  chip dims and reads "away"; they are not removed. When they come back they
  get their board back.
- **The host can skip stragglers after 30 seconds.** Once a round has been
  open 30 s and someone other than the host still hasn't acted, a "Skip waiting
  players" button appears for the host only. Skipped players simply don't place
  that round.

---

## Part A — reconcile the rooms as built

The screens below exist in `apps/web/src/routes/RoomScreen.tsx`, `CrashScreen.tsx`
and `LobbyScreen.tsx` and are live. Each was built from pass 02's provisional
frames where one existed, and improvised where none did. **Design each one
properly**, using its live copy (quoted) as the baseline — improve it, don't
just restyle it. Keep the existing frame IDs where pass 02 had a frame; they are
cited by ID in code comments, so they are stable addresses like annotations are.

### Revise pass 02's frames

- **`02a`–`02e` Lobby / waiting room.** Split into what is now two places:
  `/lobby` (name + "Create a room" / code + "Join room") and the waiting room
  at `/r/CODE`. The waiting room as built shows: the code large, a "Copy link"
  button, "Players · N of 6" with seat-ordered chips and a host marker, a
  "Boards" panel stating "Same board — Everyone fills the same picture from the
  same offers. Transportation · N pictures.", and "Start round" (disabled with
  a reason: "Only the host can start" / "Needs one more player"). Phase 6 turns
  the Boards panel into the host's **mode and pack choice** — see Part B.
- **`12a` → "done, waiting for others".** As built: status "Done for this
  round." plus "Waiting for Sam and Alex". Design the full state: what the
  board, the offers and the chips look like while you wait, and how a player
  can tell at a glance who is still placing (chips need a "still placing" /
  "done" signal that is **not colour alone**).
- **`12b`** — keep its intent (another player still placing), merged with the
  above if they collapse into one state.
- **`12c` reconnecting / someone away.** As built: the `HudFrame` connection
  pill reads "Reconnecting…" in warning tone for yourself; an away player's
  chip dims and says "away". Confirm or improve; this is pass 02's
  `ConnectionPill` proposal (note 6) meeting reality — decide whether that
  component is still wanted or `HudFrame`'s pill is enough.
- **`03g` in rooms** — the rejection toast, with D1's copy above.

### Design new frames for states that shipped without one

- **`12e` Host skip.** As built: a secondary `lg` "Skip waiting players"
  button under the status lines, host only, after 30 s. Where it sits, how it
  reads to the host (not punitive towards the people being skipped), and what
  the skipped player sees afterwards (today: nothing special — the next round
  just starts).
- **`12f` Your picture is complete, others still playing.** As built: "Your
  picture is complete!" with the offers disabled. Under Phase 6 cycling this
  becomes "your next picture starts when…" — design both the Phase 5 state and
  the Phase 6 one.
- **`12g` Checking with the room.** As built: "Checking with the room…" while
  a fill or pass is with the referee (pass 02's `03f` dimming applies). Confirm
  the copy.
- **`12h` Getting your board / joining.** As built: plain centred text
  "Joining room KM4T…" then "Getting your board…". A first-paint state for a
  shared link — consider pass 02 Annotation 17.
- **`02f` Joining by link with no name yet.** As built: "Joining room KM4T", a
  name field, "Join room". The very first screen a friend sees from a shared
  link — it should explain the game in one line, not just ask for a name.
- **`02g` Can't join.** Two terminal states, as built:
  - Room full: "Room is full — six is the most we can tell apart on a board."
    → "Back to the lobby".
  - Version mismatch: "This room runs a newer version of Pixwagon. Go back to
    the start and accept the update when it's offered." → "Back to the start".
    The update is the existing banner on Home (pass 02 `10`); a plain reload
    does not update an installed app, which is why the copy says what it says.
- **`14` Crash screen.** As built: "Something went wrong" / "Pixwagon hit a
  problem it couldn't recover from. Reloading usually fixes it — if you were in
  a room, you'll rejoin the same seat." / primary "Reload" / link "Back to the
  start". Plain on purpose (it must render even if the app's state is broken):
  keep it to existing components, no illustration that needs app state.
- **`13d` Game over (Phase 5 minimal ranking).** As built: "Room KM4T" / "Game
  over" / a "Final ranking" panel — rank number, `PlayerChip` (yours labelled
  "(you)"), and "Complete · 100 pts" or "37 of 52 squares" — and a "Back to the
  lobby" link. Phase 6 replaces this with `13a`–`13c` (Part B); design `13d`
  only as the fallback for a single-picture session, or fold it into `13a`.

---

## Part B — forward-design Phase 6

Phase 6 is being built **in parallel with this pass** (owner, 2026-10-22):
the engineering ships a provisional UI built from pass 02's `13a`–`13c`, and
this pass's result replaces its visuals afterwards. D8–D10 above are fixed
for both. Treat the live build as a baseline, not a constraint. Where the
build and this brief disagree on anything other than D1–D10, this pass wins.

- **Waiting room, host choices (`02c`–`02e` extended).** The host picks:
  - **Mode** — "Same board" (everyone the same picture) or "Own board" (each
    player a different picture from the pack, compared at the end). One line
    of explanation each; no jargon.
  - **Pack** — Transportation or Garden, using `PackCard`. Must work with two
    packs today and scale to more without a redesign.
    Non-hosts see the choices read-only, updated live. Design what a non-host
    sees when the host changes the pack mid-wait.
- **Solo start with a pack choice (`01` / `06`).** Today "Solo" on Home always
  plays Transportation, and the pack picker (`/packs`) lists packs but choosing
  one does nothing. Decide where the choice lives: on the picker, as a step
  after "Solo", or remembered from last time. Daily keeps a fixed rotation and
  shows no choice. (The provisional build remembers the pack last chosen on
  the picker; redesign freely.)
- **Own-board game (`12d`, revise).** Each player's board shows a different
  picture. Opponents appear as completion on their chips only (D9); design how
  that reads without colour, keeping D1's "no shared cells" in mind.
- **Picture cycling (new `12i`).** The moment one picture resolves (complete,
  or out of rounds) and the next begins: a progress marker ("Picture 2 of 3"),
  what happens to the finished picture, and how the round budget for the new
  picture is shown. Solo already has a session-over state across the pack (pass
  02 `05`); stay consistent with it.
- **Room results (`13a`–`13c`, revise).** Ranked by completed pictures, then
  filled squares. States: ranked with pictures side by side · a tie · someone
  who left mid-game (flagged, still ranked) · rematch offered. Rework against
  D1 for same-board sessions, where everyone's pictures are the same image.
- **`BoardCompare` (pass 02 note 6, now a real component).** Finalise it as a
  component, not a frame: side-by-side finished boards with player identity
  (hue **and** hatch) and rank, for both modes. Name it `BoardCompare`; once it
  is built, it gets a preview card and is re-synced, like every component.
- **Rematch (`13c`, revise).** Same players, new game, nobody rejoins. The
  host starts it and everyone returns to the waiting room (D10). Design what
  non-hosts see while the host decides, and what happens to a player who has
  already left the results screen.

---

## Annotations

Annotations **01–20 are stable addresses** (cited by number in code and the
roadmap). Do not renumber or re-scope them. If D1/D2 make one of them wrong
(18 and 19 in particular), mark it **superseded by NN** on the canvas and add
the replacement as a new number. New annotations start at **21**. This pass
should at least cover:

- what "waiting" means under simultaneous rounds, and how a player knows who is
  still placing without relying on colour;
- the host's powers (start, skip, pick mode and pack, rematch) and how they read
  as helpful to the host without being punitive to others;
- away vs. left: what is shown, what is kept, what the ranking says;
- picture cycling and the round budget across pictures;
- the terminal "can't join" states and why the version one doesn't say
  "reload".

## Constraints Claude Design must respect

Everything in `BRIEF-02.md`'s _Constraints_ section still applies:
phone-first at 390×844; offline solo and daily never show connection UI;
original art and copy only (Garden and Transportation pictures are the real
ones — reuse them, draw nothing new); no accounts; reduced motion with static
equivalents; **token names fixed, values replaceable**; **component names match
the code one-for-one, new components only as labelled proposals.** In addition:

- **Every player-identity signal carries the hatch as well as the hue** —
  chips, boards, ranks, `BoardCompare`. "Done", "still placing", "away" and
  "host" each need a non-colour cue (text, icon or shape).
- **Pass 02's Part A/B frames are not in scope.** If something here forces a
  change to a solo frame, label it as a proposal; do not silently redraw it.
- **No timers.** Nothing in this pass should show a countdown (D2). The 30 s
  host skip is a threshold, not a visible clock.

## After the pass

Bring the result back with the **Handoff button**. Land it at
`docs/design/handoff-03/` (pass 01's and 02's handoffs stay where they are),
with a `README.md` using the same **"What was implemented / What was NOT
implemented"** split and a **Notes for engineering** list. Then
`pnpm design:build` → `pnpm design:check` → `/design-sync` again once
`BoardCompare` (or any other accepted proposal) exists in code.
