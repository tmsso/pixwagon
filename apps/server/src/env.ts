export interface Env {
  ROOM: DurableObjectNamespace;
}

/**
 * A room seats as many players as we have visually distinguishable identities —
 * `playerColors.length` in apps/web/src/design/tokens.ts, which the server
 * cannot import because it lives in the web app.
 *
 * Duplicated here on purpose rather than guessed at each call site. Phase 4
 * should move the seat count into a package both sides can read; until then this
 * is the single server-side definition. See ROADMAP.md Phase 4.
 */
export const MAX_SEATS = 6;

/**
 * Room-code alphabet with I, O, 0 and 1 removed.
 *
 * Codes get read aloud across a table and typed by someone squinting at a phone;
 * "is that a one or an ell" is a real failure mode for a game whose entire entry
 * flow is a four-character code.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(length = 4): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('');
}
