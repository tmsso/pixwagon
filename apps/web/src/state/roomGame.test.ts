import { beforeEach, describe, expect, it } from 'vitest';
import type { PlayerPresence, RoomSnapshot, ServerMessage } from '@pixwagon/protocol';
import { applyServerMessage, useRoomGameStore } from './roomGame.ts';

// No `Roll` type is exported from @pixwagon/protocol (only `rollSchema`) —
// left untyped here and checked structurally wherever it's used as a
// ServerMessage's `roll` field below.
const roll0 = { round: 0, seed: 'seed-a', pair: ['p1-a', 'p1-b'] as const, fallback: '1' as const };

const alex: PlayerPresence = { id: 'p1', name: 'Alex', seatIndex: 0, isHost: true };
const bella: PlayerPresence = { id: 'p2', name: 'Bella', seatIndex: 1, isHost: false };

const state0: RoomSnapshot = {
  code: 'ABCD',
  mode: 'same-board',
  round: 0,
  currentRoll: null,
  hostId: 'p1',
  players: [alex],
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

  it('is a no-op for message types this phase has nothing to fold in yet (fills are Phase 5)', () => {
    const message: ServerMessage = { type: 'delta', delta: { anything: true } };
    expect(applyServerMessage({ snapshot: state0, me: null }, message)).toEqual({});
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
