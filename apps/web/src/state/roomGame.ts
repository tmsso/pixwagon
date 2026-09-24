import { create } from 'zustand';
import { PROTOCOL_VERSION } from '@pixwagon/protocol';
import type {
  PlayerPresence,
  RoomSnapshot,
  ServerErrorCode,
  ServerMessage,
} from '@pixwagon/protocol';
import { RoomConnection } from '../net/roomConnection.ts';
import type { RoomConnectionEvent, WebSocketFactory } from '../net/roomConnection.ts';

/**
 * The room store (ROADMAP.md Phase 4 client half, item 3) — separate from
 * `soloGame` (decided Phase 2: solo has no referee to disagree with).
 *
 * Deliberately thin over two pure pieces, the same split `soloGame` uses over
 * `placement.ts`/`legality.ts`: `applyServerMessage` below does the actual
 * state transitions and is exported so it — and `handleEvent`, which just adds
 * connection-status handling on top — can be unit-tested by replaying a
 * scripted event sequence directly, with no real `WebSocket` and no React.
 *
 * `state` messages replace the snapshot wholesale; resync is "apply the
 * snapshot", nothing cleverer (ROADMAP.md). `presence` and `roll` are typed
 * separately on the wire (`docs/contracts/ws-protocol.md`) and are folded into
 * the held snapshot in place rather than waiting for the next full `state`.
 */

/**
 * `'idle'` (before `join()`/after `leave()`) is added beyond the three values
 * the ROADMAP bullet named (`connecting | online | reconnecting`) — those
 * three describe an active connection's lifecycle, but the store exists
 * before any connection does, and needs a value for that too.
 */
export type RoomConnectionState = 'idle' | 'connecting' | 'online' | 'reconnecting';

export interface RoomPlayerIdentity {
  playerId: string;
  isHost: boolean;
}

function sessionKey(code: string): string {
  return `pixwagon.rejoinToken.${code}`;
}

function loadRejoinToken(code: string): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    return sessionStorage.getItem(sessionKey(code));
  } catch {
    // Private-mode quota errors — reconnecting just looks like a fresh join.
    return null;
  }
}

function persistRejoinToken(code: string, token: string): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(sessionKey(code), token);
  } catch {
    // Best effort — worst case, the next reconnect re-registers as new.
  }
}

/**
 * Errors after which the server closes the socket and a retry can only fail
 * the same way (Phase 4 item 4). Without this the transport would treat the
 * server's close as a network drop and reconnect forever into a full room.
 */
const TERMINAL_ERRORS: ReadonlySet<ServerErrorCode> = new Set([
  'room-full',
  'protocol-version-mismatch',
]);

function isHostAmong(players: readonly PlayerPresence[], playerId: string): boolean {
  return players.some((p) => p.id === playerId && p.isHost);
}

/**
 * The pure state-transition function: given what the store currently holds
 * and one inbound server message, what changes. No side effects (no storage,
 * no sockets) so a test can assert on it directly with plain objects.
 */
export function applyServerMessage(
  state: Pick<RoomGameSlice, 'snapshot' | 'me'>,
  message: ServerMessage,
): Partial<RoomGameSlice> {
  switch (message.type) {
    case 'welcome':
      // isHost is genuinely unknown until the `state` that always follows a
      // real `welcome` arrives — the server sends them back to back, so this
      // is momentarily wrong at worst, never stale.
      return {
        me: { playerId: message.playerId, isHost: state.me?.isHost ?? false },
        rejoinToken: message.rejoinToken,
      };

    case 'state':
      return {
        snapshot: message.state,
        me: state.me
          ? { playerId: state.me.playerId, isHost: message.state.hostId === state.me.playerId }
          : state.me,
      };

    case 'presence':
      return {
        snapshot: state.snapshot ? { ...state.snapshot, players: message.players } : state.snapshot,
        me: state.me
          ? { playerId: state.me.playerId, isHost: isHostAmong(message.players, state.me.playerId) }
          : state.me,
      };

    case 'roll':
      // The snapshot's `round` is "rolls issued so far" (docs/contracts/rng.md);
      // a `roll` broadcast is the same advance the server just made, mirrored
      // here rather than waiting for a full resync to see it.
      return state.snapshot
        ? {
            snapshot: {
              ...state.snapshot,
              currentRoll: message.roll,
              round: message.roll.round + 1,
            },
          }
        : {};

    case 'error':
      return { lastError: message.message };

    // Fills, deltas and round results are Phase 5 — nothing here yet to fold
    // into a snapshot that has no board state.
    default:
      return {};
  }
}

interface RoomGameSlice {
  code: string | null;
  name: string;
  connection: RoomConnectionState;
  snapshot: RoomSnapshot | null;
  me: RoomPlayerIdentity | null;
  rejoinToken: string | null;
  lastError: string | null;
  /** Set when the server refused this connection for good (`TERMINAL_ERRORS`);
   *  the store has stopped reconnecting and the screen should say why. */
  fatalError: ServerErrorCode | null;
}

export interface RoomGameState extends RoomGameSlice {
  /** Opens a connection to `url` and joins `code` as `name`, resending a
   *  previously-issued rejoin token for this code if one is in
   *  `sessionStorage`. `createSocket` is a test/Storybook seam, passed
   *  straight through to `RoomConnection`. */
  join: (url: string, code: string, name: string, createSocket?: WebSocketFactory) => void;
  /** A deliberate leave — closes the connection and clears the room, but
   *  leaves any persisted rejoin token alone (rejoining the same code later
   *  should still reclaim the same seat). */
  leave: () => void;
  requestRoll: () => void;
  /** Applies one transport event. Exposed as a store action — rather than a
   *  private detail of `join()` — specifically so a test can replay a
   *  scripted sequence of these directly, with no real connection. */
  handleEvent: (event: RoomConnectionEvent) => void;
}

/** The live connection, if any. Kept out of store state deliberately — it's
 *  an implementation detail with identity and side effects, not serialisable
 *  UI state, the same reasoning `usePwaStore` applies to nothing quite like
 *  this existing yet but would apply the same way. */
let connection: RoomConnection | null = null;

const initialSlice: RoomGameSlice = {
  code: null,
  name: '',
  connection: 'idle',
  snapshot: null,
  me: null,
  rejoinToken: null,
  lastError: null,
  fatalError: null,
};

export const useRoomGameStore = create<RoomGameState>((set, get) => ({
  ...initialSlice,

  join: (url, code, name, createSocket) => {
    connection?.close();
    set({
      ...initialSlice,
      code,
      name,
      connection: 'connecting',
      rejoinToken: loadRejoinToken(code),
    });
    connection = new RoomConnection({
      url,
      onEvent: (event) => get().handleEvent(event),
      ...(createSocket ? { createSocket } : {}),
    });
  },

  leave: () => {
    connection?.close();
    connection = null;
    set({ ...initialSlice });
  },

  requestRoll: () => {
    connection?.send({ type: 'request-roll' });
  },

  handleEvent: (event) => {
    if (event.type === 'status') {
      switch (event.status) {
        case 'open': {
          // Reaching the socket is not "online" yet — that's `welcome`, the
          // room-level handshake this send kicks off.
          const state = get();
          connection?.send({
            type: 'join',
            protocolVersion: PROTOCOL_VERSION,
            name: state.name,
            rejoinToken: state.rejoinToken ?? undefined,
          });
          return;
        }
        case 'reconnecting':
          set({ connection: 'reconnecting' });
          return;
        case 'connecting':
          set({ connection: 'connecting' });
          return;
        case 'closed':
          set({ connection: 'idle' });
          return;
      }
    }

    if (event.type === 'decode-error') {
      set({ lastError: event.error });
      return;
    }

    const state = get();
    const patch = applyServerMessage(state, event.message);
    if (event.message.type === 'welcome') {
      // 'online' lands here, not in applyServerMessage: connection status is
      // this layer's concern, not the pure message-handling function's.
      set({ ...patch, connection: 'online' });
      // `code` is only unset if `handleEvent` is driven directly without a
      // preceding `join()` — real usage always has it by the time a `welcome`
      // arrives, but nothing here depends on that being true.
      if (state.code) persistRejoinToken(state.code, event.message.rejoinToken);
      return;
    }
    if (event.message.type === 'error' && TERMINAL_ERRORS.has(event.message.code)) {
      // Close deliberately *before* the server's own close lands, so the
      // transport sees a leave rather than a drop and does not reconnect.
      set({ ...patch, fatalError: event.message.code });
      connection?.close();
      connection = null;
      return;
    }
    set(patch);
  },
}));
