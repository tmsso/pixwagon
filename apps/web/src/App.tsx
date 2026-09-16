import { BrowserRouter, Link, Route, Routes } from 'react-router';
import { UpdateBanner } from './pwa/UpdateBanner.tsx';
import { GameScreen } from './routes/GameScreen.tsx';
import { HomeScreen } from './routes/HomeScreen.tsx';
import { LobbyScreen } from './routes/LobbyScreen.tsx';
import { PackPickerScreen } from './routes/PackPickerScreen.tsx';
import { ResultsScreen } from './routes/ResultsScreen.tsx';

/**
 * Five routes for the six design surfaces in architecture.md §4B — the sixth,
 * the round-offer control (`RollControl`), is a component rather than a
 * navigable screen; it appears inside the game screen and is designed as its
 * own surface.
 *
 * Home, Game (solo), Results and PackPicker are real (Phase 2). Lobby is still
 * a placeholder until the Phase 4 client half wires a room; `/r/:code` is
 * solo-only until Phase 5 feeds it server state.
 */
export function App() {
  return (
    <BrowserRouter>
      {/* A service-worker update banner, above every route. It gates itself to
          stay out of an in-progress round (Annotation 17). */}
      <UpdateBanner />
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
