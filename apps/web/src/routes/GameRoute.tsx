import { Link, useParams } from 'react-router';
import { roomCodeSchema } from '@pixwagon/protocol';
import { GameScreen } from './GameScreen.tsx';
import { RoomScreen } from './RoomScreen.tsx';

/**
 * `/r/:code` picks its store by code (ROADMAP.md Phase 4 item 4): `solo` is
 * the local `soloGame` store with no network at all; anything else is a room
 * on the worker via `roomGame`. Two separate screens rather than one screen
 * branching on its data source, so neither store's hooks run on the other's
 * route.
 */
export function GameRoute() {
  const code = (useParams().code ?? '').toUpperCase();
  if (code === 'SOLO') return <GameScreen />;

  // The worker answers a malformed code with a 400 before any socket opens,
  // which the transport would retry forever — so turn it away here.
  if (!roomCodeSchema.safeParse(code).success) {
    return (
      <main className="grid min-h-dvh place-items-center bg-bg p-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold text-ink">That isn&rsquo;t a room code</h1>
          <Link to="/lobby" className="mt-3 inline-block text-accent underline">
            Back to the lobby
          </Link>
        </div>
      </main>
    );
  }

  // `key` gives each room code a fresh screen (and fresh name-gate state).
  return <RoomScreen key={code} code={code} />;
}
