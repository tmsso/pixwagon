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
import type { RoomSnapshot } from '@pixwagon/protocol';
import { GameRoute } from '../apps/web/src/routes/GameRoute.tsx';
import { HomeScreen } from '../apps/web/src/routes/HomeScreen.tsx';
import { LobbyScreen } from '../apps/web/src/routes/LobbyScreen.tsx';
import { PackPickerScreen } from '../apps/web/src/routes/PackPickerScreen.tsx';
import { ResultsScreen } from '../apps/web/src/routes/ResultsScreen.tsx';
import { useRoomGameStore } from '../apps/web/src/state/roomGame.ts';

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
    { id: 'p-alex', name: 'Alex', seatIndex: 0, isHost: true },
    { id: 'p-sam', name: 'Sam', seatIndex: 1, isHost: false },
  ],
  status: 'lobby',
  pictureId: null,
  roundBudget: null,
  boards: {},
  acted: [],
};

// zustand hooks answer a server render from the store's *initial* state (the
// `getServerSnapshot` side of React's `useSyncExternalStore`), never its
// current one — so a `setState` seed is invisible to `renderToStaticMarkup`.
// The hook closes over its store privately, so the one lever a script has is
// the initial-state object itself: seed by writing into it. Fine for a
// one-shot render check; never do this in app code.
function seedRoom(snapshot: RoomSnapshot): void {
  Object.assign(useRoomGameStore.getInitialState(), {
    code: snapshot.code,
    name: 'Alex',
    connection: 'online',
    snapshot,
    me: { playerId: 'p-alex', isHost: true },
    rejoinToken: 'fixture-token',
    lastError: null,
    fatalError: null,
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
    expect: ['Pixwagon', 'Solo', 'Daily puzzle'],
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
    name: 'Room (game)',
    path: '/r/TRAM',
    routePath: '/r/:code',
    element: <GameRoute />,
    setup: () =>
      seedRoom({
        ...waitingSnapshot,
        round: 3,
        currentRoll: { round: 2, seed: 'fixture', pair: ['domino', 'tromino-l'], fallback: '1+2' },
        status: 'playing',
      }),
    expect: ['TRAM', 'Round 3', 'Connected', 'The pair', 'Placing pieces arrives', 'Next round'],
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
    expect: ['Shape packs', 'Transportation', 'pictures'],
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
