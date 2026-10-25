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
  });
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
    expect: ['Pixwagon', 'Solo', 'Daily puzzle', 'Solo plays', 'Transportation'],
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
    expect: ['TRAM', 'Players · 2 of 6', 'Alex', 'Sam', 'host', 'Start round'],
  },
  {
    name: 'Room (waiting, host picks own-board + Garden)',
    path: '/r/TRAM',
    routePath: '/r/:code',
    element: <GameRoute />,
    setup: () => seedRoom({ ...waitingSnapshot, mode: 'own-board', packId: 'garden' }),
    expect: ['Same board', 'Own board', 'Pack', 'Garden', 'Transportation'],
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
    expect: ['Own board', 'Garden · 3 pictures', 'The host chooses the mode and the pack.'],
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
    // Kim dropped mid-game: listed, dimmed, labelled "away" (pass 02 `12c`).
    expect: ['TRAM', 'Round 3', 'Connected', 'The pair', 'The single', 'You', 'Kim', 'away'],
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
    // D9: opponents show completion on their chips (Sam and Kim: 0%).
    expect: ['Picture 2 of 3', 'Round 1 of 40', 'On to picture 2 of 3', '0%'],
  },
  {
    name: 'Room (acted, waiting for others)',
    path: '/r/TRAM',
    routePath: '/r/:code',
    element: <GameRoute />,
    setup: () => seedRoom({ ...playingSnapshot, acted: ['p-alex'] }),
    expect: ['Done for this round.', 'Waiting for Sam'],
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
    expect: [
      'Game over',
      'Final ranking',
      '1.',
      'Sam',
      '1 complete',
      'Alex (you)',
      'squares',
      'Rematch',
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
    // Alex and Sam each completed one picture; the half boards tie them on
    // squares too. Kim is away, so flagged as having left.
    expect: [
      'Own board · 2 pictures',
      'tied',
      'left',
      '✓ complete',
      'The host can start a rematch for everyone here.',
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
      'Shape packs',
      'Transportation',
      'Garden',
      'Pictures in Transportation',
      'Play solo with Transportation',
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
