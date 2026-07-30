import { BrowserRouter, Link, Route, Routes } from 'react-router';
import { GameScreen } from './routes/GameScreen.tsx';
import { HomeScreen } from './routes/HomeScreen.tsx';
import { LobbyScreen } from './routes/LobbyScreen.tsx';
import { PackPickerScreen } from './routes/PackPickerScreen.tsx';
import { ResultsScreen } from './routes/ResultsScreen.tsx';

/**
 * Five routes for the six design surfaces in architecture.md §4B — the sixth,
 * the roll/combo control, is a component rather than a navigable screen, since a
 * routed URL for a dice widget would not make sense. It appears inside the game
 * screen and is designed as its own surface.
 *
 * Phase 0: every screen is a placeholder built from the real component shells,
 * so the routing, tokens and components are all provably wired before any
 * gameplay exists.
 */
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/lobby" element={<LobbyScreen />} />
        <Route path="/r/:code" element={<GameScreen />} />
        <Route path="/results" element={<ResultsScreen />} />
        <Route path="/packs" element={<PackPickerScreen />} />
        <Route
          path="*"
          element={
            <main className="grid min-h-dvh place-items-center bg-bg p-6 text-center">
              <div>
                <h1 className="text-2xl font-semibold text-ink">No such page</h1>
                <Link to="/" className="mt-3 inline-block text-accent underline">
                  Back to the start
                </Link>
              </div>
            </main>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
