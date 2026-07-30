export interface Env {
  ROOM: DurableObjectNamespace;
}

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
