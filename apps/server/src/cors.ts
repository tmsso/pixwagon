/**
 * CORS for the worker's plain-HTTP endpoints (ROADMAP.md decision D4).
 *
 * The web app (`pixwagon.pages.dev`) and this worker live on different
 * origins. A cross-origin WebSocket needs no CORS — but `POST /api/room` is an
 * ordinary `fetch`, and a browser will send it, let the server answer, and
 * then refuse to hand the response to the page unless the response names the
 * page's origin in `Access-Control-Allow-Origin`. Without this the Lobby could
 * create a room and never learn its code.
 *
 * An explicit allowlist rather than `*`: nothing here is secret, but naming
 * the origins keeps "who is this API for" readable in one place.
 */

const ALLOWED_ORIGINS = new Set([
  'https://pixwagon.pages.dev',
  // `pnpm dev` and `vite preview`, for the local two-tab test.
  'http://localhost:5173',
  'http://localhost:4173',
]);

/** Cloudflare Pages preview deploys live at `<hash-or-branch>.pixwagon.pages.dev`. */
const PAGES_PREVIEW = /^https:\/\/[a-z0-9-]+\.pixwagon\.pages\.dev$/;

export function isAllowedOrigin(origin: string | null): origin is string {
  if (!origin) return false;
  return ALLOWED_ORIGINS.has(origin) || PAGES_PREVIEW.test(origin);
}

/**
 * Headers to add to a response for `origin`. Empty for a disallowed or absent
 * origin — the request still gets its normal answer (CORS is enforced by the
 * browser, not here), the page just can't read it. `Vary: Origin` tells caches
 * the response differs per requesting origin.
 */
export function corsHeaders(origin: string | null): Record<string, string> {
  if (!isAllowedOrigin(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    Vary: 'Origin',
  };
}
