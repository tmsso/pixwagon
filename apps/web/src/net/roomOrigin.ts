/**
 * Where the room worker lives (ROADMAP.md decision D4, Phase 4 client half
 * item 5). The web app and the worker are deliberately on two origins —
 * `pixwagon.pages.dev` and `pixwagon-app.tmsso.workers.dev` — so every network
 * call the client makes has to name the worker's origin explicitly.
 *
 * Resolution order: an explicit `VITE_ROOM_ORIGIN` build-time variable wins;
 * otherwise `pnpm dev` points at a local `wrangler dev` (`pnpm dev:server`,
 * port 8787) and a production build points at the live worker. Vite inlines
 * `import.meta.env.*` at build time, so the origin is baked into the bundle —
 * a Pages deploy must be a production build (`vite build`), not a dev one.
 *
 * `import.meta.env` is optional-chained because this module is also loaded
 * outside Vite: `scripts/check-screens.tsx` renders screens under `tsx`, where
 * `import.meta.env` does not exist at all.
 */

const PRODUCTION_ORIGIN = 'https://pixwagon-app.tmsso.workers.dev';
const LOCAL_ORIGIN = 'http://localhost:8787';

export function resolveRoomOrigin(env: {
  VITE_ROOM_ORIGIN?: string | undefined;
  DEV?: boolean | undefined;
}): string {
  const explicit = env.VITE_ROOM_ORIGIN?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  return env.DEV ? LOCAL_ORIGIN : PRODUCTION_ORIGIN;
}

export const ROOM_ORIGIN = resolveRoomOrigin(
  (import.meta as { env?: { VITE_ROOM_ORIGIN?: string; DEV?: boolean } }).env ?? {},
);

/** `POST` target for creating a room. */
export function createRoomUrl(origin: string = ROOM_ORIGIN): string {
  return `${origin}/api/room`;
}

/**
 * The WebSocket URL for a room. A socket URL must use `ws:`/`wss:`, not
 * `http:`/`https:` — so the scheme is swapped here rather than making every
 * caller remember it (`https` → `wss` keeps the connection encrypted).
 */
export function roomSocketUrl(code: string, origin: string = ROOM_ORIGIN): string {
  const socketOrigin = origin.replace(/^http(s?):/, 'ws$1:');
  return `${socketOrigin}/api/room/${encodeURIComponent(code.toUpperCase())}/ws`;
}
