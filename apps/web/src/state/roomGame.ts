import { create } from 'zustand';
import { applyMove, fillCells } from '@pixwagon/game-core';
import type { Board, CellRef, MoveRejection, Roll } from '@pixwagon/game-core';
import { PROTOCOL_VERSION } from '@pixwagon/protocol';
import type {
  PlayerPresence,
  RoomSnapshot,
  ServerErrorCode,
  ServerMessage,
  WireMoveChoice,
} from '@pixwagon/protocol';
import {
  clearActive as clearActivePending,
  isPendingComplete,
  mirrorActivePiece,
  placeActiveOrigin as placeActivePendingOrigin,
  type PendingChoice,
  rotateActivePiece,
  setActive as setActivePending,
  startFallback,
  startPair,
  toggleBlobCell as toggleBlobPendingCell,
  toMoveChoice,
} from './placement.ts';
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
 * An optimistic fill (Phase 5 item 3): the cells this client's own
 * `applyMove` said the move covers, sent to the referee and not yet ruled on.
 * Deliberately *not* a predicted board: the board shown stays the server's
 * (`snapshot.boards[me]`) and these cells draw on top as `candidate`, so a
 * rollback is "forget the overlay" — there is no second board to keep in
 * sync with deltas, and nothing to restore.
 */
export interface Prediction {
  round: number;
  cells: CellRef[];
}

/** The player's own board as the server last confirmed it. */
export function myBoard(
  snapshot: RoomSnapshot | null,
  me: RoomPlayerIdentity | null,
): Board | null {
  if (!snapshot || !me) return null;
  // The wire's `packId`/`pictureId` are plain strings; game-core's `Board`
  // is the same shape (drift-tested server-side), so this only re-labels.
  return (snapshot.boards[me.playerId] as Board | undefined) ?? null;
}

function withActed(acted: readonly string[], playerId: string): string[] {
  return acted.includes(playerId) ? [...acted] : [...acted, playerId];
}

/** Fold one player's newly filled cells into the held snapshot. `fillCells`
 *  is idempotent, which matters: the actor gets the same cells twice, once in
 *  `fill-accepted` and again in the `delta` broadcast to everyone. */
function withFilled(
  snapshot: RoomSnapshot,
  playerId: string,
  cells: readonly CellRef[],
): RoomSnapshot {
  const board = snapshot.boards[playerId] as Board | undefined;
  return {
    ...snapshot,
    boards: board ? { ...snapshot.boards, [playerId]: fillCells(board, cells) } : snapshot.boards,
    acted: withActed(snapshot.acted, playerId),
  };
}

/** Errors that mean "the fill/pass you are waiting on will never be ruled
 *  on" — clear the wait instead of leaving the sheet dimmed forever. */
const SETTLES_PENDING: ReadonlySet<ServerErrorCode> = new Set([
  'already-acted',
  'not-playing',
  'bad-message',
]);

/**
 * The pure state-transition function: given what the store currently holds
 * and one inbound server message, what changes. No side effects (no storage,
 * no sockets) so a test can assert on it directly with plain objects.
 */
export function applyServerMessage(
  state: Pick<RoomGameSlice, 'snapshot' | 'me'> & Partial<Pick<RoomGameSlice, 'prediction'>>,
  message: ServerMessage,
): Partial<RoomGameSlice> {
  const meId = state.me?.playerId;
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
      // A full snapshot is the truth: if our fill was accepted its cells are
      // in it, if it was lost they are not — either way the overlay goes.
      return {
        snapshot: message.state,
        me: state.me
          ? { playerId: state.me.playerId, isHost: message.state.hostId === state.me.playerId }
          : state.me,
        prediction: null,
        passPending: false,
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
      // here rather than waiting for a full resync to see it. A new round
      // also clears `acted` — the server resets it on every roll it issues,
      // and keeping the old list would show everyone as already done.
      return state.snapshot
        ? {
            snapshot: {
              ...state.snapshot,
              currentRoll: message.roll,
              round: message.roll.round + 1,
              acted: [],
            },
            pending: null,
            prediction: null,
            passPending: false,
            lastRejection: null,
          }
        : {};

    case 'delta': {
      if (!state.snapshot) return {};
      const patch: Partial<RoomGameSlice> = {
        snapshot: withFilled(state.snapshot, message.delta.playerId, message.delta.cells),
      };
      if (message.delta.playerId === meId) patch.prediction = null;
      return patch;
    }

    case 'fill-accepted': {
      // Only settles the prediction it answers: the cells are truth either
      // way, but a ruling for an older round must not clear a newer one.
      const settles = state.prediction?.round === message.round;
      if (!state.snapshot) return settles ? { prediction: null } : {};
      return {
        snapshot: withFilled(state.snapshot, message.playerId, message.cells),
        ...(settles ? { prediction: null } : {}),
      };
    }

    case 'fill-rejected':
      // The rollback: drop the overlay, so the board shows exactly what the
      // server holds — which never included those cells. A rejection for a
      // fill we are no longer waiting on is stale and ignored: if the host
      // skipped us (or the round closed on a disconnect) while our fill was
      // in flight, the new round's `roll` has already cleared the overlay,
      // and the server's "wrong-round" for the old fill must not then flash
      // "didn't fit" across the fresh round.
      if (state.prediction?.round !== message.round) return {};
      return { prediction: null, lastRejection: message.reason };

    case 'passed': {
      if (!state.snapshot) return {};
      const patch: Partial<RoomGameSlice> = {
        snapshot: { ...state.snapshot, acted: withActed(state.snapshot.acted, message.playerId) },
      };
      if (message.playerId === meId) patch.passPending = false;
      return patch;
    }

    case 'round-result':
      // Scores are recomputed from the snapshot's boards wherever they are
      // shown (`roomRanking`), so a reconnect after the end — which gets a
      // `state`, never this message — ranks identically. Only the end itself
      // needs recording here.
      return message.sessionEnded && state.snapshot
        ? { snapshot: { ...state.snapshot, status: 'ended' } }
        : {};

    case 'error':
      return SETTLES_PENDING.has(message.code)
        ? { lastError: message.message, prediction: null, passPending: false }
        : { lastError: message.message };

    case 'pong':
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
  /** The choice being composed this round — the same `PendingChoice` solo
   *  composes, built by the same pure `placement.ts` functions. */
  pending: PendingChoice | null;
  /** A fill sent and not yet ruled on (see `Prediction`). */
  prediction: Prediction | null;
  /** A pass sent and not yet echoed back as `passed`. */
  passPending: boolean;
  /** Why the referee refused the last fill — drives the non-scolding line. */
  lastRejection: MoveRejection | null;
  /** Local clock (ms) when this client first saw the round in play. The
   *  host's "Skip waiting players" button appears `SKIP_WAITING_AFTER_MS`
   *  after this; it can only be later than the server's own stamp, so the
   *  button never shows before the server would accept the skip. */
  roundSeenAt: number | null;
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
  choose: (kind: 'pair' | 'fallback') => void;
  setActive: (index: number) => void;
  rotateActive: () => void;
  mirrorActive: () => void;
  placeActiveOrigin: (cell: CellRef) => void;
  toggleBlobCell: (cell: CellRef) => void;
  clearActive: () => void;
  cancelChoice: () => void;
  /** Predict the pending choice with game-core's `applyMove` — the referee's
   *  own function — and send it as a `fill`. A choice this client already
   *  knows is illegal is never sent; it is shown as rejected right away. */
  commit: () => void;
  pass: () => void;
  skipWaiting: () => void;
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
  pending: null,
  prediction: null,
  passPending: false,
  lastRejection: null,
  roundSeenAt: null,
};

function updatePending(
  pending: PendingChoice | null,
  fn: (choice: PendingChoice) => PendingChoice,
): PendingChoice | null {
  return pending ? fn(pending) : pending;
}

/** The round in play and this player's board, if they can act on it now. */
function actable(state: RoomGameSlice): { roll: Roll; board: Board } | null {
  const snapshot = state.snapshot;
  const board = myBoard(snapshot, state.me);
  if (!snapshot || snapshot.status !== 'playing' || !snapshot.currentRoll || !board) return null;
  if (state.me && snapshot.acted.includes(state.me.playerId)) return null;
  if (state.prediction || state.passPending) return null;
  // The wire roll's piece ids are plain strings; the server issued them via
  // game-core's `issueRoll`, so they are real `PieceId`s.
  return { roll: snapshot.currentRoll as Roll, board };
}

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

  choose: (kind) => {
    const ready = actable(get());
    if (!ready) return;
    set({
      pending: kind === 'pair' ? startPair(ready.roll) : startFallback(ready.roll),
      lastRejection: null,
    });
  },
  setActive: (index) =>
    set((state) => ({ pending: updatePending(state.pending, (c) => setActivePending(c, index)) })),
  rotateActive: () =>
    set((state) => ({ pending: updatePending(state.pending, rotateActivePiece) })),
  mirrorActive: () =>
    set((state) => ({ pending: updatePending(state.pending, mirrorActivePiece) })),
  placeActiveOrigin: (cell) =>
    set((state) => ({
      pending: updatePending(state.pending, (c) => placeActivePendingOrigin(c, cell)),
    })),
  toggleBlobCell: (cell) =>
    set((state) => ({
      pending: updatePending(state.pending, (c) => toggleBlobPendingCell(c, cell)),
    })),
  clearActive: () =>
    set((state) => ({ pending: updatePending(state.pending, clearActivePending) })),
  cancelChoice: () => set({ pending: null, lastRejection: null }),

  commit: () => {
    const state = get();
    const ready = actable(state);
    if (!ready || !state.me || !state.pending || !isPendingComplete(state.pending)) return;

    const choice = toMoveChoice(state.pending);
    const round = ready.roll.round;
    const predicted = applyMove(ready.board, ready.roll, {
      playerId: state.me.playerId,
      round,
      choice,
    });
    if (!predicted.ok) {
      set({ pending: null, lastRejection: predicted.reason });
      return;
    }

    // Cells the prediction filled that the confirmed board had not.
    const cells: CellRef[] = [];
    predicted.board.cells.forEach((cell, index) => {
      if (cell !== ready.board.cells[index]) {
        cells.push({
          x: index % ready.board.size.width,
          y: Math.floor(index / ready.board.size.width),
        });
      }
    });
    set({ pending: null, lastRejection: null, prediction: { round, cells } });
    // game-core's `MoveChoice` marks its arrays `readonly`; the wire type does
    // not. Same data, so the cast only drops the modifier.
    connection?.send({ type: 'fill', round, choice: choice as WireMoveChoice });
  },

  pass: () => {
    const ready = actable(get());
    if (!ready) return;
    set({ pending: null, lastRejection: null, passPending: true });
    connection?.send({ type: 'pass', round: ready.roll.round });
  },

  skipWaiting: () => {
    const roll = get().snapshot?.currentRoll;
    if (roll) connection?.send({ type: 'skip-waiting', round: roll.round });
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
    // Stamped here, not in the pure function: it reads the clock. A `state`
    // for the round we already saw keeps the old stamp, so a resync doesn't
    // restart the host's skip countdown.
    const nextRound = patch.snapshot?.currentRoll?.round;
    if (nextRound !== undefined && nextRound !== state.snapshot?.currentRoll?.round) {
      patch.roundSeenAt = Date.now();
    }
    if (patch.snapshot && patch.snapshot !== state.snapshot && state.pending) {
      // The board under a half-composed choice can't change mid-round (only
      // our own fill changes it), but the round can — `roll` already clears
      // `pending`; a `state` resync onto a new round must too.
      if (patch.snapshot.currentRoll?.round !== state.snapshot?.currentRoll?.round) {
        patch.pending = null;
      }
    }
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
