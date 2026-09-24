import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@pixwagon/protocol';

export interface Env {
  ROOM: DurableObjectNamespace;
}

// The seat count moved to `@pixwagon/protocol` as `MAX_PLAYERS` (Phase 4) — one
// definition both the server and the web app read, instead of a copy here and
// `playerColors.length` there.

// The room-code alphabet (no I, O, 0, 1) lives in `@pixwagon/protocol` as
// `ROOM_CODE_ALPHABET` — the Lobby validates typed codes against it too.

export function generateRoomCode(length = ROOM_CODE_LENGTH): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length]).join('');
}
