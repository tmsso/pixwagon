# Claude Design brief — Pixwagon

Hand this to Claude Design after `/design-sync` has uploaded `design-system/`. Everything below assumes Design is binding to that card index, not inventing components.

## The product in a paragraph

A browser-based, installable-PWA, real-time roll-and-fill pixel game. Players share a room code; each round a fair dice/combo is issued and players fill grid squares to complete a pixel picture. It should feel quick, tactile and friendly — a game you pull out at a table with two other people, on a phone, for ten minutes. Not a competitive esport, not a puzzle app that wants your email address.

**Four modes:** same board (everyone fills the identical picture from the same dice), own board (parallel pictures, compared at the end), solo, and a daily puzzle. Solo and daily work offline.

**No accounts.** Identity is a display name plus a room code. Nothing on screen should imply a profile, a login, or a persistent history.

## What already exists and must be used

- **Tokens:** `apps/web/src/design/tokens.ts`, shown as the `Colors` / `Type` / `Spacing` foundation cards. Values are **provisional** — treat the names as fixed and the values as replaceable. Proposing better values is welcome; renaming or inventing tokens is not.
- **Components:** the `Components` and `Board` cards. Names match the code one-for-one: `Button`, `IconButton`, `Panel`, `Dialog`, `RoomCodeInput`, `PlayerChip`, `DiceFace`, `RollControl`, `BoardCell`, `BoardCanvas`, `PicturePreview`, `PackCard`, `HudFrame`.

## The six surfaces

Five are routes; the sixth is a component that deserves designing in its own right.

### 1. Home (`/`)

The first screen, and the one that has to make the game legible in three seconds. Mode choice: Solo, Daily, Play with friends. Entry point to the pack picker.
_States:_ first visit (no display name yet) · returning (name remembered) · daily already completed today.

### 2. Lobby (`/lobby`)

Join by code, or create a room. Shows who is in the room before the game starts, and who is host.
_States:_ entering a code · invalid code · waiting for others (1 player) · ready (2+) · room full (6).
_Data on screen:_ the room code big enough to read aloud across a table, a share affordance, player list, mode selector, pack selector.

### 3. Game (`/r/:code`) — the screen that matters

Board, current roll, whose turn, everyone's progress. Phone-first: the board is the hero, controls sit within thumb reach.
_States:_ waiting for roll · rolling · filling (option selected, candidate cells highlighted) · awaiting server confirmation · fill rejected · round scoring · someone disconnected.
_Data on screen:_ board, dice, combo options, player chips with progress, round number, connection state.

### 4. Roll/combo control (component, lives inside Game)

Dice display, the combo options a roll permits, and the commit action. **Design it as its own surface** — it is where every turn actually happens.
_States:_ idle · rolling · options available · option selected · awaiting server truth (disabled but not hidden — the layout must not jump) · no legal move available.

### 5. Results (`/results`)

End of round or game. Completed picture revealed, scores, comparison in own-board mode, rematch.
_States:_ solo completion · multiplayer ranked · a tie · someone left mid-game.

### 6. Pack picker (`/packs`)

Browse shape packs and the pictures inside them. Should make it obvious that more packs are coming.
_States:_ pack selected · locked/coming-soon pack · a picture already completed.

## Annotations to make on canvas

These travel with the handoff, so put them on the canvas rather than only in chat. Seeded with what the architecture already implies:

1. **`BoardCell` needs six states** — `blank`, `fillable`, `candidate`, `filled`, `locked`, `invalid`. `invalid` is not decorative: it is the visible rollback when the server rejects an optimistic fill, and it must read as "that was undone", not as an error the player caused.
2. **Player colours must survive colour-vision deficiency**, and colour must never be the only signal — every player also carries a hatch pattern. Preserve the hatch in every design that shows player identity. See the `Player colours` foundation card.
3. **The board must scale crisply** from a small phone to a desktop. It renders on Canvas with integer scaling and no smoothing; designs should not assume arbitrary fractional sizing or soft shadows on cells.
4. **`RollControl` needs a disabled-but-present state** while awaiting server truth. Hiding it would make the layout jump at the worst moment.
5. **Room codes get read aloud.** Monospace, generously spaced, unambiguous. The alphabet already excludes `I`, `O`, `0` and `1`.
6. **Minimum touch target 2.75rem**, one-handed reach on a phone. The primary action of each screen should sit in the lower half.

## Constraints Design must respect

- **Phone-first.** Design the small viewport first; desktop is the adaptation, not the source.
- **Offline-capable solo and daily.** Nothing in those flows may depend on a network state indicator being green.
- **Original art only.** All pixel pictures, palettes and copy are original to this project. Do not reproduce artwork, iconography, rulebook phrasing or the visual identity of any existing commercial game. Do not name any such game in the output.
- **No accounts.** No profile, avatar-upload, settings-sync or login surfaces.
- **Reduced motion is a real requirement**, wired through duration tokens. Anything that only works when animated needs a static equivalent.

## After the design pass

Bring the result back via the **Handoff button**, which opens a fresh Claude Code session preloaded with the design context. Then re-run `pnpm design:build` and re-sync whenever tokens or component shells change — the sync is a snapshot, not a live view.
