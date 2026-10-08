import { beforeEach, describe, expect, it } from 'vitest';
import { createBoard, issueRoll } from '@pixwagon/game-core';
import type { Board, CellRef } from '@pixwagon/game-core';
import type { ClientMessage, PlayerPresence, RoomSnapshot } from '@pixwagon/protocol';
import { applyServerMessage, myBoard, useRoomGameStore } from './roomGame.ts';

// No `Roll` type is exported from @pixwagon/protocol (only `rollSchema`) —
// left untyped here and checked structurally wherever it's used as a
// ServerMessage's `roll` field below.
const roll0 = { round: 0, seed: 'seed-a', pair: ['p1-a', 'p1-b'] as const, fallback: '1' as const };

const alex: PlayerPresence = {
  id: 'p1',
  name: 'Alex',
  seatIndex: 0,
  isHost: true,
  connected: true,
};
const bella: PlayerPresence = {
  id: 'p2',
  name: 'Bella',
  seatIndex: 1,
  isHost: false,
  connected: true,
};

const state0: RoomSnapshot = {
  code: 'ABCD',
  mode: 'same-board',
  round: 0,
  currentRoll: null,
  hostId: 'p1',
  players: [alex],
  status: 'lobby',
  pictureId: null,
  roundBudget: null,
  boards: {},
  acted: [],
};

describe('applyServerMessage', () => {
  it('welcome sets me from playerId, keeping isHost unknown (false) until state confirms it', () => {
    const patch = applyServerMessage(
      { snapshot: null, me: null },
      { type: 'welcome', protocolVersion: 1, playerId: 'p1', code: 'ABCD', rejoinToken: 'tok-1' },
    );
    expect(patch).toEqual({ me: { playerId: 'p1', isHost: false }, rejoinToken: 'tok-1' });
  });

  it('welcome on a reconnect preserves the isHost the store already knows', () => {
    const patch = applyServerMessage(
      { snapshot: state0, me: { playerId: 'p1', isHost: true } },
      { type: 'welcome', protocolVersion: 1, playerId: 'p1', code: 'ABCD', rejoinToken: 'tok-2' },
    );
    expect(patch.me).toEqual({ playerId: 'p1', isHost: true });
  });

  it('state replaces the snapshot wholesale and recomputes isHost from hostId', () => {
    const state1: RoomSnapshot = { ...state0, players: [alex, bella], hostId: 'p2' };
    const patch = applyServerMessage(
      { snapshot: state0, me: { playerId: 'p1', isHost: true } },
      { type: 'state', state: state1 },
    );
    expect(patch.snapshot).toBe(state1);
    expect(patch.me).toEqual({ playerId: 'p1', isHost: false });
  });

  it('presence folds the new player list into the held snapshot without a full resync', () => {
    const patch = applyServerMessage(
      { snapshot: state0, me: { playerId: 'p1', isHost: true } },
      { type: 'presence', players: [alex, bella] },
    );
    expect(patch.snapshot).toEqual({ ...state0, players: [alex, bella] });
    expect(patch.me).toEqual({ playerId: 'p1', isHost: true });
  });

  it('presence is a no-op when there is no snapshot yet to fold into', () => {
    const patch = applyServerMessage(
      { snapshot: null, me: null },
      { type: 'presence', players: [alex] },
    );
    expect(patch.snapshot).toBeNull();
  });

  it('roll advances round and sets currentRoll, mirroring the server side issueNextRoll', () => {
    const patch = applyServerMessage({ snapshot: state0, me: null }, { type: 'roll', roll: roll0 });
    expect(patch.snapshot).toEqual({ ...state0, currentRoll: roll0, round: 1 });
  });

  it('error sets lastError', () => {
    const patch = applyServerMessage(
      { snapshot: null, me: null },
      { type: 'error', code: 'not-host', message: 'only the host can start the next round' },
    );
    expect(patch).toEqual({ lastError: 'only the host can start the next round' });
  });

  it('roll resets acted — the server clears it on every roll it issues', () => {
    const patch = applyServerMessage(
      { snapshot: { ...state0, acted: ['p1', 'p2'] }, me: null },
      { type: 'roll', roll: roll0 },
    );
    expect(patch.snapshot?.acted).toEqual([]);
  });
});

describe('useRoomGameStore.handleEvent', () => {
  beforeEach(() => {
    // Resets both the store's state and the module-level connection handle —
    // the store is a zustand singleton (same pattern as useSoloGameStore /
    // usePwaStore), so tests share it and must not leak into each other.
    useRoomGameStore.getState().leave();
  });

  it('tracks connecting/reconnecting/idle from connection-status events alone', () => {
    const { handleEvent } = useRoomGameStore.getState();
    handleEvent({ type: 'status', status: 'connecting' });
    expect(useRoomGameStore.getState().connection).toBe('connecting');

    handleEvent({ type: 'status', status: 'reconnecting' });
    expect(useRoomGameStore.getState().connection).toBe('reconnecting');

    handleEvent({ type: 'status', status: 'closed' });
    expect(useRoomGameStore.getState().connection).toBe('idle');
  });

  it('surfaces a transport decode-error as lastError without touching the snapshot', () => {
    useRoomGameStore.getState().handleEvent({ type: 'decode-error', error: 'not valid JSON' });
    const state = useRoomGameStore.getState();
    expect(state.lastError).toBe('not valid JSON');
    expect(state.snapshot).toBeNull();
  });

  // The scripted sequence ROADMAP.md's Phase 4 item 3 bullet names as this
  // deliverable's Done means: welcome -> state -> presence -> roll -> drop ->
  // reconnect -> state. Driven straight through handleEvent, with no real
  // RoomConnection or socket — this is exactly what exposing it as a store
  // action (rather than a join()-private detail) buys.
  it('replays a full connect/drop/reconnect sequence and ends equal to the last snapshot', () => {
    const { handleEvent } = useRoomGameStore.getState();

    handleEvent({
      type: 'message',
      message: {
        type: 'welcome',
        protocolVersion: 1,
        playerId: 'p1',
        code: 'ABCD',
        rejoinToken: 'tok-1',
      },
    });
    handleEvent({ type: 'message', message: { type: 'state', state: state0 } });
    handleEvent({ type: 'message', message: { type: 'presence', players: [alex, bella] } });
    handleEvent({ type: 'message', message: { type: 'roll', roll: roll0 } });

    let state = useRoomGameStore.getState();
    expect(state.connection).toBe('online');
    expect(state.me).toEqual({ playerId: 'p1', isHost: true });
    expect(state.snapshot).toEqual({
      ...state0,
      players: [alex, bella],
      currentRoll: roll0,
      round: 1,
    });

    // drop
    handleEvent({ type: 'status', status: 'reconnecting' });
    expect(useRoomGameStore.getState().connection).toBe('reconnecting');

    // reconnect: the transport is open again — join() was never called in
    // this test, so there's no live connection for the resent `join` to go
    // out on, but handling the event must not throw for that reason.
    expect(() => handleEvent({ type: 'status', status: 'open' })).not.toThrow();

    const finalState: RoomSnapshot = {
      ...state0,
      players: [alex, bella],
      currentRoll: roll0,
      round: 1,
      hostId: 'p2',
    };
    handleEvent({
      type: 'message',
      message: {
        type: 'welcome',
        protocolVersion: 1,
        playerId: 'p1',
        code: 'ABCD',
        rejoinToken: 'tok-2',
      },
    });
    handleEvent({ type: 'message', message: { type: 'state', state: finalState } });

    state = useRoomGameStore.getState();
    expect(state.connection).toBe('online');
    expect(state.snapshot).toEqual(finalState);
    expect(state.me).toEqual({ playerId: 'p1', isHost: false });
    expect(state.rejoinToken).toBe('tok-2');
  });
});

describe('terminal server errors', () => {
  beforeEach(() => {
    useRoomGameStore.getState().leave();
  });

  it('room-full stops reconnecting: the store closes its own socket and records why', () => {
    const sockets: { closed: boolean; onopen: (() => void) | null }[] = [];
    useRoomGameStore.getState().join('ws://test/api/room/ABCD/ws', 'ABCD', 'Alex', () => {
      const socket = {
        closed: false,
        send: () => {},
        close() {
          socket.closed = true;
        },
        onopen: null as (() => void) | null,
        onclose: null,
        onmessage: null,
        onerror: null,
      };
      sockets.push(socket);
      return socket;
    });

    useRoomGameStore.getState().handleEvent({
      type: 'message',
      message: { type: 'error', code: 'room-full', message: 'this room is full' },
    });

    const state = useRoomGameStore.getState();
    expect(state.fatalError).toBe('room-full');
    expect(state.connection).toBe('idle');
    expect(sockets).toHaveLength(1);
    expect(sockets[0]?.closed).toBe(true);
  });

  it('an ordinary error (not-host) is not terminal', () => {
    useRoomGameStore.getState().handleEvent({
      type: 'message',
      message: { type: 'error', code: 'not-host', message: 'only the host can start' },
    });
    expect(useRoomGameStore.getState().fatalError).toBeNull();
    expect(useRoomGameStore.getState().lastError).toBe('only the host can start');
  });
});

// ---------------------------------------------------------------------------
// Phase 5 item 3 — optimistic fill and rollback
// ---------------------------------------------------------------------------

/** Two horizontally adjacent fillable cells — a legal `2` fallback blob. */
function legalPair(board: Board): CellRef[] {
  for (let y = 0; y < board.size.height; y += 1) {
    for (let x = 0; x + 1 < board.size.width; x += 1) {
      const i = y * board.size.width + x;
      if (board.cells[i] === 'fillable' && board.cells[i + 1] === 'fillable') {
        return [
          { x, y },
          { x: x + 1, y },
        ];
      }
    }
  }
  throw new Error('fixture board has no adjacent fillable pair');
}

describe('optimistic fill (Phase 5 item 3)', () => {
  const board = createBoard('transportation', 'tram');
  // A roll whose fallback face is a single 2-cell blob, so one legal choice
  // is easy to build by hand.
  const roll = { ...issueRoll('seed-fill', 0), fallback: '2' as const };
  const playing: RoomSnapshot = {
    ...state0,
    players: [alex, bella],
    status: 'playing',
    pictureId: board.pictureId,
    roundBudget: 40,
    round: 1,
    currentRoll: roll,
    boards: { p1: board, p2: board },
    acted: [],
  };
  const cells = legalPair(board);
  let sent: ClientMessage[] = [];

  beforeEach(() => {
    useRoomGameStore.getState().leave();
    sent = [];
    const socket = {
      send: (raw: string) => sent.push(JSON.parse(raw) as ClientMessage),
      close: () => {},
      onopen: null as (() => void) | null,
      onclose: null,
      onmessage: null,
      onerror: null,
    };
    useRoomGameStore.getState().join('ws://test/api/room/ABCD/ws', 'ABCD', 'Alex', () => socket);
    // The transport only sends once open; the store answers `open` with its
    // `join`, which is the first thing `sent` records.
    socket.onopen?.();
    const { handleEvent } = useRoomGameStore.getState();
    handleEvent({
      type: 'message',
      message: {
        type: 'welcome',
        protocolVersion: 2,
        playerId: 'p1',
        code: 'ABCD',
        rejoinToken: 't',
      },
    });
    handleEvent({ type: 'message', message: { type: 'state', state: playing } });
    useRoomGameStore.setState({
      pending: { kind: 'fallback', blobs: [{ size: 2, cells }], active: 0 },
    });
  });

  it('commit predicts with applyMove, overlays the cells, and leaves the confirmed board alone', () => {
    useRoomGameStore.getState().commit();
    const state = useRoomGameStore.getState();
    expect(state.prediction).toEqual({ round: 0, cells });
    expect(state.pending).toBeNull();
    expect(myBoard(state.snapshot, state.me)).toBe(board);
  });

  // ROADMAP.md Phase 5 item 3's Done means.
  it('rolls back when the server rejects a move the client predicted as legal', () => {
    useRoomGameStore.getState().commit();
    useRoomGameStore.getState().handleEvent({
      type: 'message',
      message: { type: 'fill-rejected', round: 0, reason: 'wrong-round' },
    });
    const state = useRoomGameStore.getState();
    expect(state.prediction).toBeNull();
    expect(state.lastRejection).toBe('wrong-round');
    // The board is exactly the pre-move board: no cell of the prediction stuck.
    expect(myBoard(state.snapshot, state.me)).toEqual(board);
    expect(state.snapshot?.acted).toEqual([]);
    // ...and the player may try again this round (a rejected fill isn't acting).
    useRoomGameStore.getState().choose('fallback');
    expect(useRoomGameStore.getState().pending).not.toBeNull();
  });

  it('acceptance folds the cells into the confirmed board, idempotently with the delta', () => {
    useRoomGameStore.getState().commit();
    const { handleEvent } = useRoomGameStore.getState();
    handleEvent({
      type: 'message',
      message: { type: 'fill-accepted', playerId: 'p1', round: 0, cells },
    });
    handleEvent({
      type: 'message',
      message: { type: 'delta', delta: { playerId: 'p1', round: 0, cells } },
    });
    const state = useRoomGameStore.getState();
    const mine = myBoard(state.snapshot, state.me)!;
    for (const c of cells) expect(mine.cells[c.y * mine.size.width + c.x]).toBe('filled');
    expect(mine.cells.filter((c) => c === 'filled')).toHaveLength(cells.length);
    expect(state.prediction).toBeNull();
    expect(state.snapshot?.acted).toEqual(['p1']);
    // Acting is once per round.
    useRoomGameStore.getState().choose('fallback');
    expect(useRoomGameStore.getState().pending).toBeNull();
  });

  it('sends the fill as intent and never shows another player a cell before their delta', () => {
    useRoomGameStore.getState().commit();
    expect(sent.at(-1)).toMatchObject({ type: 'fill', round: 0, choice: { kind: 'fallback' } });
    const before = useRoomGameStore.getState().snapshot!.boards.p2;
    useRoomGameStore.getState().handleEvent({
      type: 'message',
      message: { type: 'delta', delta: { playerId: 'p2', round: 0, cells } },
    });
    const after = useRoomGameStore.getState().snapshot!;
    expect(after.boards.p2).not.toEqual(before);
    expect(after.acted).toEqual(['p2']);
  });

  it('pass waits for its echo; passed marks acting; the next roll clears the round', () => {
    useRoomGameStore.getState().pass();
    expect(sent.at(-1)).toEqual({ type: 'pass', round: 0 });
    expect(useRoomGameStore.getState().passPending).toBe(true);
    const { handleEvent } = useRoomGameStore.getState();
    handleEvent({ type: 'message', message: { type: 'passed', playerId: 'p1', round: 0 } });
    handleEvent({ type: 'message', message: { type: 'passed', playerId: 'p2', round: 0 } });
    expect(useRoomGameStore.getState().passPending).toBe(false);
    expect(useRoomGameStore.getState().snapshot?.acted).toEqual(['p1', 'p2']);

    const seenBefore = useRoomGameStore.getState().roundSeenAt;
    handleEvent({ type: 'message', message: { type: 'roll', roll: issueRoll('seed-fill', 1) } });
    const state = useRoomGameStore.getState();
    expect(state.snapshot?.acted).toEqual([]);
    expect(state.snapshot?.currentRoll?.round).toBe(1);
    expect(state.roundSeenAt).not.toBeNull();
    expect(state.roundSeenAt! >= seenBefore!).toBe(true);
  });

  it('a session-ending round-result marks the room ended', () => {
    useRoomGameStore.getState().handleEvent({
      type: 'message',
      message: {
        type: 'round-result',
        result: { round: 0, scores: [], complete: false },
        sessionEnded: true,
      },
    });
    expect(useRoomGameStore.getState().snapshot?.status).toBe('ended');
  });

  it('an already-acted error clears the wait instead of dimming the sheet forever', () => {
    useRoomGameStore.getState().commit();
    useRoomGameStore.getState().handleEvent({
      type: 'message',
      message: { type: 'error', code: 'already-acted', message: 'you have already played' },
    });
    expect(useRoomGameStore.getState().prediction).toBeNull();
  });
});
