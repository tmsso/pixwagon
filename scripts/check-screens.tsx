/**
 * Renders every route screen server-side and asserts it produces real markup.
 *
 * `vite build` succeeding proves the code compiles, not that anything appears on
 * screen — a component that throws on render, or renders `null`, builds
 * perfectly. This catches that.
 *
 * Scope, stated honestly: this is a server render in Node, not a browser paint.
 * It proves each screen mounts without throwing, produces substantial markup,
 * and reaches for the design tokens. It does not prove the page *looks* right —
 * that needs eyes on `pnpm dev`.
 */

import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
// Relative, not `@pixwagon/game-core`: the workspace root doesn't depend on
// the package (the type-only protocol import below is erased at runtime).
import { createBoard, fillCells, issueRoll } from '../packages/game-core/src/index.ts';
import type { RoomSnapshot } from '@pixwagon/protocol';
import { GameRoute } from '../apps/web/src/routes/GameRoute.tsx';
import { HomeScreen } from '../apps/web/src/routes/HomeScreen.tsx';
import { LobbyScreen } from '../apps/web/src/routes/LobbyScreen.tsx';
import { GameSheet } from '../apps/web/src/routes/room/GameSettings.tsx';
import { JoiningBoard, JoiningRoom } from '../apps/web/src/routes/room/Joining.tsx';
import { PackPickerScreen } from '../apps/web/src/routes/PackPickerScreen.tsx';
import { ResultsScreen } from '../apps/web/src/routes/ResultsScreen.tsx';
import { useRoomGameStore } from '../apps/web/src/state/roomGame.ts';
import { dailyConfig } from '../apps/web/src/state/daily.ts';
import { useSoloGameStore } from '../apps/web/src/state/soloGame.ts';

/**
 * A room as the server would describe it (Phase 4). The room screens read
 * the `roomGame` store, and a server render runs no effects — so no socket
 * ever opens here; each room case seeds the store with this instead.
 */
const waitingSnapshot: RoomSnapshot = {
  code: 'TRAM',
  mode: 'same-board',
  round: 0,
  currentRoll: null,
  hostId: 'p-alex',
  players: [
    { id: 'p-alex', name: 'Alex', seatIndex: 0, isHost: true, connected: true },
    { id: 'p-sam', name: 'Sam', seatIndex: 1, isHost: false, connected: true },
  ],
  status: 'lobby',
  pictureId: null,
  roundBudget: null,
  packId: 'transportation',
  stage: 0,
  stageCount: null,
  stageStartRound: 0,
  history: [],
  boards: {},
  acted: [],
};

// zustand hooks answer a server render from the store's *initial* state (the
// `getServerSnapshot` side of React's `useSyncExternalStore`), never its
// current one — so a `setState` seed is invisible to `renderToStaticMarkup`.
// The hook closes over its store privately, so the one lever a script has is
// the initial-state object itself: seed by writing into it. Fine for a
// one-shot render check; never do this in app code.
const tram = createBoard('transportation', 'tram');
const tramFillable = tram.cells.flatMap((cell, i) =>
  cell === 'fillable' ? [{ x: i % tram.size.width, y: Math.floor(i / tram.size.width) }] : [],
);
const tramDone = fillCells(tram, tramFillable);
const tramHalf = fillCells(tram, tramFillable.slice(0, Math.floor(tramFillable.length / 2)));

/** A same-board game in round 3 (Phase 5): everyone holds a copy of `tram`. */
const playingSnapshot: RoomSnapshot = {
  ...waitingSnapshot,
  round: 3,
  currentRoll: { round: 2, seed: 'fixture', pair: ['domino', 'tromino-l'], fallback: '1+2' },
  status: 'playing',
  pictureId: 'tram',
  roundBudget: 40,
  packId: 'transportation',
  stage: 0,
  stageCount: 3,
  stageStartRound: 0,
  history: [],
  players: [
    ...waitingSnapshot.players,
    { id: 'p-kim', name: 'Kim', seatIndex: 2, isHost: false, connected: false },
  ],
  boards: { 'p-alex': tramHalf, 'p-sam': tram, 'p-kim': tram },
  acted: [],
};

function seedRoom(
  snapshot: RoomSnapshot,
  me: { playerId: string; isHost: boolean } = { playerId: 'p-alex', isHost: true },
): void {
  Object.assign(useRoomGameStore.getInitialState(), {
    code: snapshot.code,
    name: 'Alex',
    connection: 'online',
    snapshot,
    me,
    rejoinToken: 'fixture-token',
    lastError: null,
    fatalError: null,
    configChange: null,
    returnedFromResults: false,
    // In-game transients: every case starts from a quiet, undisturbed round.
    pending: null,
    prediction: null,
    passPending: false,
    lastRejection: null,
    roundSeenAt: null,
    skipped: false,
  });
}

/** Layers store fields (a held sheet, a skip notice…) over a seeded room. */
function seedGame(extra: Record<string, unknown>): void {
  Object.assign(useRoomGameStore.getInitialState(), extra);
}

/** A room the player is in but the server hasn't described yet, or has turned
 *  them away from — `code: null` is "not in any room" (the join gate). */
function seedUnjoined(partial: {
  code: string | null;
  fatalError?: 'room-full' | 'protocol-version-mismatch' | 'replaced';
}): void {
  Object.assign(useRoomGameStore.getInitialState(), {
    code: partial.code,
    name: 'Alex',
    connection: 'connecting',
    snapshot: null,
    me: null,
    rejoinToken: null,
    lastError: null,
    fatalError: partial.fatalError ?? null,
    configChange: null,
  });
}

function seedSolo(config: ReturnType<typeof dailyConfig>, status: 'playing' | 'complete'): void {
  Object.assign(useSoloGameStore.getInitialState(), {
    daily: config.daily ?? null,
    packId: config.packId,
    pictureId: config.pictureId,
    roomSeed: config.roomSeed,
    round: 0,
    board: createBoard(config.packId, config.pictureId),
    roll: issueRoll(config.roomSeed, 0),
    status,
  });
}

interface ScreenCase {
  name: string;
  /** The URL to visit. */
  path: string;
  /** The route pattern to register, when it differs from the URL (`/r/:code`). */
  routePath?: string;
  element: ReactNode;
  /** Runs before the render — seeds a store the screen reads. */
  setup?: () => void;
  /** Strings that must appear — proof the screen rendered its own content. */
  expect: string[];
}

const screens: ScreenCase[] = [
  {
    name: 'Home',
    path: '/',
    element: <HomeScreen />,
    // `01d`: Solo carries its pack and a Change button, replacing the old
    // "Solo plays …" panel.
    expect: ['Pixwagon', 'Solo', 'Transportation · 3 pictures', 'Change', 'Daily puzzle'],
  },
  {
    name: 'Lobby',
    path: '/lobby',
    element: <LobbyScreen />,
    expect: ['Join room', 'Create a room', 'Room code', 'Your name'],
  },
  {
    name: 'Game (solo)',
    path: '/r/solo',
    routePath: '/r/:code',
    element: <GameRoute />,
    expect: ['SOLO', 'Round 1', 'The pair', 'The single'],
  },
  {
    name: 'Room (waiting)',
    // Lowercase on purpose: uppercasing a typed URL code is real behaviour.
    path: '/r/tram',
    routePath: '/r/:code',
    element: <GameRoute />,
    setup: () => seedRoom(waitingSnapshot),
    expect: [
      'TRAM',
      'Players · 2 of 6',
      'Alex',
      'Sam',
      'you · host',
      'This game',
      'Same board · Transportation',
      '3 pictures, played in turn',
      'Change',
      'Start game',
    ],
  },
  {
    // `02c`: the host alone. Starting needs two, and the status says how to
    // get one.
    name: 'Room (waiting, host alone)',
    path: '/r/TRAM',
    routePath: '/r/:code',
    element: <GameRoute />,
    setup: () => seedRoom({ ...waitingSnapshot, players: [waitingSnapshot.players[0]!] }),
    expect: [
      'Players · 1 of 6',
      'Send them the link, or read out the code.',
      'Needs one more player',
      'Copy link',
    ],
  },
  {
    // `02e`: six seats, with the player-facing reason for the cap.
    name: 'Room (waiting, full)',
    path: '/r/TRAM',
    routePath: '/r/:code',
    element: <GameRoute />,
    setup: () =>
      seedRoom({
        ...waitingSnapshot,
        players: ['Alex', 'Sam', 'Jo', 'Ravi', 'Mia', 'Kim'].map((name, seatIndex) => ({
          id: `p-${name.toLowerCase()}`,
          name,
          seatIndex,
          isHost: seatIndex === 0,
          connected: true,
        })),
      }),
    expect: ['Players · 6 of 6', 'Room is full', 'Kim', 'Start game'],
  },
  {
    name: 'Room (waiting, host picks own-board + Garden)',
    path: '/r/TRAM',
    routePath: '/r/:code',
    element: <GameRoute />,
    setup: () => seedRoom({ ...waitingSnapshot, mode: 'own-board', packId: 'garden' }),
    expect: ['Own board · Garden', 'A different picture each, 3 in turn', 'Change'],
  },
  {
    // `02h`: the host's sheet. Local state in `WaitingRoom`, so rendered
    // directly rather than through the route.
    name: 'Room (host sheet: This game)',
    path: '/r/TRAM',
    routePath: '/r/:code',
    element: <GameSheet snapshot={{ ...waitingSnapshot, packId: 'garden' }} onClose={() => {}} />,
    expect: [
      'This game',
      'Same board',
      'Own board',
      'Everyone fills the same picture from the same offers.',
      'Transportation',
      'Garden',
      'role="radiogroup"',
      'aria-checked="true"',
      'Done',
    ],
  },
  {
    name: 'Room (waiting, guest sees the choice)',
    path: '/r/TRAM',
    routePath: '/r/:code',
    element: <GameRoute />,
    setup: () =>
      seedRoom(
        { ...waitingSnapshot, mode: 'own-board', packId: 'garden' },
        { playerId: 'p-sam', isHost: false },
      ),
    // A guest gets no Start button and no Change — one line saying who decides.
    expect: ['Own board · Garden', 'Alex picks', 'Alex starts the game when everyone'],
  },
  {
    // `02i`: the host changed it while the guest was watching.
    name: 'Room (waiting, guest sees what changed)',
    path: '/r/TRAM',
    routePath: '/r/:code',
    element: <GameRoute />,
    setup: () => {
      seedRoom(
        { ...waitingSnapshot, mode: 'own-board', packId: 'garden' },
        { playerId: 'p-sam', isHost: false },
      );
      Object.assign(useRoomGameStore.getInitialState(), {
        configChange: { from: { mode: 'same-board', packId: 'transportation' } },
      });
    },
    expect: ['Alex changed this from Same board · Transportation.'],
  },
  {
    // Pass 03 `02f`: a shared link on a device with no saved name.
    name: 'Room (join gate, link opened with no name)',
    path: '/r/KM4T',
    routePath: '/r/:code',
    element: <GameRoute />,
    setup: () => seedUnjoined({ code: null }),
    expect: [
      'Join the game',
      'What should the others call you?',
      'No sign-up. Your name is only used in this room.',
      'role="img"',
    ],
  },
  {
    // `12h`, first: joined the socket, no `state` yet. Rendered through the
    // room route with the delay off (a server render has no 400 ms to wait).
    name: 'Room (joining, before the room answers)',
    path: '/r/KM4T',
    routePath: '/r/:code',
    element: <JoiningRoom code="KM4T" delayMs={0} />,
    expect: ['Room code', 'KM4T', 'Players', 'Joining room'],
  },
  {
    // `12h`, second: connected mid-game, own board not in the snapshot yet.
    name: 'Room (joining mid-game, getting your board)',
    path: '/r/TRAM',
    routePath: '/r/:code',
    element: (
      <JoiningBoard
        delayMs={0}
        hud={{ roomCode: 'TRAM', round: 3, roundOf: 40, connection: 'online' }}
      />
    ),
    expect: ['TRAM', 'Round 3 of 40', 'Getting your board…'],
  },
  {
    name: "Room (can't join: full)",
    path: '/r/KM4T',
    routePath: '/r/:code',
    element: <GameRoute />,
    setup: () => seedUnjoined({ code: 'KM4T', fatalError: 'room-full' }),
    expect: ['This room is full', 'Room KM4T', 'Back to the lobby'],
  },
  {
    name: "Room (can't join: newer version)",
    path: '/r/KM4T',
    routePath: '/r/:code',
    element: <GameRoute />,
    setup: () => seedUnjoined({ code: 'KM4T', fatalError: 'protocol-version-mismatch' }),
    // The static picture of the banner carries the live banner's real words.
    expect: [
      'This room needs an update',
      'On the start screen, look for this:',
      'A new version is ready.',
      'Update',
      'Back to the start',
    ],
  },
  {
    name: "Room (can't join: open in another tab)",
    path: '/r/KM4T',
    routePath: '/r/:code',
    element: <GameRoute />,
    setup: () => seedUnjoined({ code: 'KM4T', fatalError: 'replaced' }),
    expect: ['Open somewhere else', 'Play here', 'Nothing is lost either way.'],
  },
  {
    name: 'Room (game)',
    path: '/r/TRAM',
    routePath: '/r/:code',
    element: <GameRoute />,
    setup: () => seedRoom(playingSnapshot),
    // `12b` + `12c`: you are still placing; Kim dropped and is dimmed, labelled
    // "away"; every chip says where its player is, in words.
    expect: [
      'TRAM',
      'Round 3',
      'Connected',
      'The pair',
      'The single',
      'You',
      'Kim',
      'placing',
      'away',
      'the pair</b> or',
    ],
  },
  {
    // `12d`: own board — opponents as completion only, and why.
    name: 'Room (game, own board: completion on chips)',
    path: '/r/TRAM',
    routePath: '/r/:code',
    element: <GameRoute />,
    setup: () => seedRoom({ ...playingSnapshot, mode: 'own-board' }),
    expect: ['Sam', '0%', 'Your own picture — everyone gets the same offers.'],
  },
  {
    // `12g`: after Place, the sheet stays up, held and disabled, "Placing…".
    name: 'Room (game, checking with the room: sheet held)',
    path: '/r/TRAM',
    routePath: '/r/:code',
    element: <GameRoute />,
    setup: () => {
      seedRoom(playingSnapshot);
      seedGame({
        prediction: {
          round: 2,
          cells: [{ x: 4, y: 4 }],
          sheet: {
            kind: 'fallback',
            blobs: [{ size: 1, cells: [{ x: 4, y: 4 }] }],
            active: 0,
          },
        },
      });
    },
    expect: ['Placing…', 'inert', 'Checking with the room…', 'Take back'],
  },
  {
    // `03g`: the referee said no. Never scolding.
    name: 'Room (game, move refused)',
    path: '/r/TRAM',
    routePath: '/r/:code',
    element: <GameRoute />,
    setup: () => {
      seedRoom(playingSnapshot);
      seedGame({ lastRejection: 'cell-already-filled' });
    },
    expect: ['Those squares didn’t fit — try another spot.', 'role="alert"'],
  },
  {
    // `12c`: reconnecting says the board is safe.
    name: 'Room (game, reconnecting)',
    path: '/r/TRAM',
    routePath: '/r/:code',
    element: <GameRoute />,
    setup: () => {
      seedRoom(playingSnapshot);
      seedGame({ connection: 'reconnecting' });
    },
    expect: ['Reconnecting…', 'Your board is safe.'],
  },
  {
    // `12e`: a round open 30 s — the host can move on, in words that help.
    name: 'Room (game, host can move on)',
    path: '/r/TRAM',
    routePath: '/r/:code',
    element: <GameRoute />,
    setup: () => {
      seedRoom({ ...playingSnapshot, acted: ['p-alex'] });
      seedGame({ roundSeenAt: Date.now() - 60_000 });
    },
    expect: [
      'Done for this round.',
      'Waiting for Sam — the next round starts by itself.',
      'Move on without Sam',
      'Sam keeps their board and plays the next round.',
      'Only you see this.',
    ],
  },
  {
    // `12e`, second frame: the skipped player's next round.
    name: 'Room (game, you were moved on without)',
    path: '/r/TRAM',
    routePath: '/r/:code',
    element: <GameRoute />,
    setup: () => {
      seedRoom(playingSnapshot, { playerId: 'p-sam', isHost: false });
      seedGame({ skipped: true });
    },
    expect: ['The room moved on to a new round. Your board is just as you left it.'],
  },
  {
    name: 'Room (picture 2 of 3, first round)',
    path: '/r/TRAM',
    routePath: '/r/:code',
    element: <GameRoute />,
    setup: () =>
      seedRoom({
        ...playingSnapshot,
        stage: 1,
        round: 11,
        stageStartRound: 10,
        currentRoll: { ...playingSnapshot.currentRoll!, round: 10 },
        history: [{ 'p-alex': tramDone, 'p-sam': tramHalf, 'p-kim': tram }],
      }),
    // The header marker is squares plus "2 of 3", with the full phrase as
    // its accessible name (pass 03 note 8); the strip above the board reports
    // the picture just played, in words (`12i`, note 9).
    expect: [
      'aria-label="Picture 2 of 3"',
      '2 of 3',
      'Round 1 of 40',
      'Picture 1 · Tram',
      'Complete · 100 points',
      'a fresh board and 40 rounds.',
    ],
  },
  {
    // `12i`, second frame: the last picture ran out of rounds.
    name: 'Room (picture 2 of 3, the last one was unfinished, own board)',
    path: '/r/TRAM',
    routePath: '/r/:code',
    element: <GameRoute />,
    setup: () =>
      seedRoom({
        ...playingSnapshot,
        mode: 'own-board',
        stage: 1,
        round: 11,
        stageStartRound: 10,
        currentRoll: { ...playingSnapshot.currentRoll!, round: 10 },
        history: [{ 'p-alex': tramHalf, 'p-sam': tramDone, 'p-kim': tram }],
      }),
    expect: [
      'Unfinished · scores nothing',
      'Nothing fitted those last',
      'a fresh board. 40 rounds for everyone this picture.',
    ],
  },
  {
    // `12f`: your picture is complete and the room waits for the others.
    name: 'Room (your picture is complete, next one waits for the room)',
    path: '/r/TRAM',
    routePath: '/r/:code',
    element: <GameRoute />,
    setup: () =>
      seedRoom({
        ...playingSnapshot,
        boards: { 'p-alex': tramDone, 'p-sam': tramHalf, 'p-kim': tram },
      }),
    expect: [
      'Picture 1 of 3 complete',
      'Tram · 100 points',
      'Picture 2 starts for everyone when Sam is done with this one.',
      'finished',
    ],
  },
  {
    name: 'Room (your picture is complete, one-picture session)',
    path: '/r/TRAM',
    routePath: '/r/:code',
    element: <GameRoute />,
    setup: () =>
      seedRoom({
        ...playingSnapshot,
        stageCount: 1,
        boards: { 'p-alex': tramDone, 'p-sam': tramHalf, 'p-kim': tram },
      }),
    expect: ['Picture complete', 'Sam is still placing. The results open when they&#x27;re done.'],
  },
  {
    name: 'Room (acted, waiting for others)',
    path: '/r/TRAM',
    routePath: '/r/:code',
    element: <GameRoute />,
    setup: () => seedRoom({ ...playingSnapshot, acted: ['p-alex'] }),
    expect: ['Done for this round.', 'Waiting for Sam — the next round starts by itself.'],
  },
  {
    // `13c`, host: back in the waiting room after Rematch, with Ravi away.
    name: 'Room (waiting after a rematch, host)',
    path: '/r/TRAM',
    routePath: '/r/:code',
    element: <GameRoute />,
    setup: () => {
      seedRoom({
        ...waitingSnapshot,
        players: [
          ...waitingSnapshot.players,
          { id: 'p-ravi', name: 'Ravi', seatIndex: 2, isHost: false, connected: false },
        ],
      });
      seedGame({ returnedFromResults: true });
    },
    expect: [
      'Rematch — same room, new offers. Change the game if you like, then start.',
      'Ravi left before the rematch. Their seat waits',
      'Start game',
    ],
  },
  {
    name: 'Room (waiting after a rematch, guest)',
    path: '/r/TRAM',
    routePath: '/r/:code',
    element: <GameRoute />,
    setup: () => {
      seedRoom(waitingSnapshot, { playerId: 'p-sam', isHost: false });
      seedGame({ returnedFromResults: true });
    },
    expect: ['Rematch — you’re back in room TRAM with everyone.', 'Alex starts the game when'],
  },
  {
    name: 'Room (ended)',
    path: '/r/TRAM',
    routePath: '/r/:code',
    element: <GameRoute />,
    setup: () =>
      seedRoom({
        ...playingSnapshot,
        status: 'ended',
        boards: { 'p-alex': tramHalf, 'p-sam': tramDone, 'p-kim': tram },
      }),
    // `13a`: a headline in words, the session in aligned columns, Rematch for
    // the host. Sam finished the picture; Alex and Kim did not.
    expect: [
      'Game over · Transportation · same board',
      'Sam wins',
      'Ranked by pictures finished, then squares.',
      '1st',
      'Kim',
      'You',
      '✓ done',
      'unfinished',
      'Rematch',
      'Leave room',
    ],
  },
  {
    name: 'Room (results, own-board, guest)',
    path: '/r/TRAM',
    routePath: '/r/:code',
    element: <GameRoute />,
    setup: () =>
      seedRoom(
        {
          ...playingSnapshot,
          mode: 'own-board',
          status: 'ended',
          stage: 1,
          stageCount: 2,
          history: [{ 'p-alex': tramDone, 'p-sam': tramHalf, 'p-kim': tram }],
          boards: { 'p-alex': tramHalf, 'p-sam': tramDone, 'p-kim': tram },
        },
        { playerId: 'p-sam', isHost: false },
      ),
    // `13b`: Alex and Sam each completed one picture and the half boards tie
    // them on squares too; Kim is away, so flagged as having left. Own board:
    // every cell names its own picture.
    expect: [
      'Game over · Transportation · own board',
      'It’s a tie',
      'You and Alex finished the same pictures with the same number of squares.',
      'Picture 1',
      'Picture 2',
      '1st · tied',
      'left · 0',
      '✓ Tram',
      'Alex can start a rematch. Stay here and you’re in.',
    ],
  },
  {
    name: 'Results',
    path: '/results',
    element: <ResultsScreen />,
    // Pulls a real picture name and live score out of the solo store.
    expect: ['Rematch', 'Tram', 'Score'],
  },
  {
    name: 'PackPicker',
    path: '/packs',
    element: <PackPickerScreen />,
    expect: [
      'Packs',
      'Pick the pack Solo plays.',
      'Transportation',
      'Garden',
      '3 pictures · Tulip, Watering can, Mushroom',
      'In Transportation',
      'Play Transportation',
      'Solo will play Transportation from now on.',
      'role="radiogroup"',
    ],
  },
  // Last on purpose: these seed the solo store's *initial* state (see
  // `seedRoom`'s note), which every later solo case would then inherit.
  {
    name: 'Game (daily)',
    path: '/r/daily',
    routePath: '/r/:code',
    element: <GameRoute />,
    setup: () => seedSolo(dailyConfig(new Date('2026-10-22T12:00:00Z')), 'playing'),
    expect: ['DAILY', 'Round 1', 'The pair', 'The single'],
  },
  {
    name: 'Results (daily)',
    path: '/results',
    element: <ResultsScreen />,
    setup: () => seedSolo(dailyConfig(new Date('2026-10-22T12:00:00Z')), 'complete'),
    expect: [
      'Daily puzzle · 2026-10-22',
      'A new daily puzzle arrives at midnight UTC.',
      'Back home',
    ],
  },
];

const MIN_MARKUP = 800;
let failed = 0;

for (const screen of screens) {
  let html: string;
  try {
    screen.setup?.();
    html = renderToStaticMarkup(
      <MemoryRouter initialEntries={[screen.path]}>
        <Routes>
          <Route path={screen.routePath ?? screen.path} element={screen.element} />
        </Routes>
      </MemoryRouter>,
    );
  } catch (error) {
    console.error(`✗ ${screen.name}: threw during render — ${String(error)}`);
    failed += 1;
    continue;
  }

  const problems: string[] = [];
  if (html.length < MIN_MARKUP) problems.push(`only ${html.length} bytes of markup`);
  for (const needle of screen.expect) {
    if (!html.includes(needle)) problems.push(`missing "${needle}"`);
  }
  // Every screen should be styled by the token layer, not by ad-hoc colours.
  if (!/class="[^"]*\b(bg-bg|bg-surface|text-ink)\b/.test(html)) {
    problems.push('no design-token classes found');
  }

  if (problems.length > 0) {
    console.error(`✗ ${screen.name}: ${problems.join('; ')}`);
    failed += 1;
  } else {
    console.log(`✓ ${screen.name} (${html.length} bytes)`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} screen(s) failed to render properly.`);
  process.exit(1);
}
console.log(`\nAll ${screens.length} screens render.`);
