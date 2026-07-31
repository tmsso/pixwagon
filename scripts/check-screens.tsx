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
import { GameScreen } from '../apps/web/src/routes/GameScreen.tsx';
import { HomeScreen } from '../apps/web/src/routes/HomeScreen.tsx';
import { LobbyScreen } from '../apps/web/src/routes/LobbyScreen.tsx';
import { PackPickerScreen } from '../apps/web/src/routes/PackPickerScreen.tsx';
import { ResultsScreen } from '../apps/web/src/routes/ResultsScreen.tsx';

interface ScreenCase {
  name: string;
  /** The URL to visit. */
  path: string;
  /** The route pattern to register, when it differs from the URL (`/r/:code`). */
  routePath?: string;
  element: ReactNode;
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
    expect: ['Join', 'Create room', 'Room code'],
  },
  {
    name: 'Game',
    path: '/r/pixw',
    routePath: '/r/:code',
    element: <GameScreen />,
    // Uppercasing a lowercase URL code is real behaviour worth asserting.
    expect: ['PIXW', 'Round 1', 'Pair', 'Fallback'],
  },
  {
    name: 'Results',
    path: '/results',
    element: <ResultsScreen />,
    // Pulls a real picture name out of the transportation pack.
    expect: ['Round over', 'Rematch', 'Tram'],
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
