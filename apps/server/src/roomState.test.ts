import { describe, expect, it } from 'vitest';
import { issueRoll } from '@pixwagon/game-core';
import { FALLBACK_FACE_IDS } from '@pixwagon/game-core';
import { fallbackFaceSchema, MAX_PLAYERS } from '@pixwagon/protocol';
import {
  buildSnapshot,
  currentRoll,
  ensureSeed,
  initialRoomState,
  issueNextRoll,
  nextFreeSeat,
  presenceList,
  resolveHost,
  roomIsFull,
  type SeatedConn,
} from './roomState.ts';

const conn = (id: string, seatIndex: number, name = id): SeatedConn => ({ id, name, seatIndex });

describe('nextFreeSeat', () => {
  it('returns the lowest unused seat', () => {
    expect(nextFreeSeat([])).toBe(0);
    expect(nextFreeSeat([0, 1, 3])).toBe(2);
    expect(nextFreeSeat([2, 0, 1])).toBe(3);
  });

  it('wraps once every seat is taken rather than returning out of range', () => {
    const all = Array.from({ length: MAX_PLAYERS }, (_, i) => i);
    expect(nextFreeSeat(all)).toBeLessThan(MAX_PLAYERS);
  });
});

describe('roomIsFull', () => {
  it('is true only at MAX_PLAYERS joined', () => {
    expect(roomIsFull(MAX_PLAYERS - 1)).toBe(false);
    expect(roomIsFull(MAX_PLAYERS)).toBe(true);
  });
});

describe('ensureSeed', () => {
  it('sets the seed once and never overwrites it', () => {
    const s0 = initialRoomState('PIXW');
    expect(s0.roomSeed).toBeNull();
    const s1 = ensureSeed(s0, 'seed-one');
    expect(s1.roomSeed).toBe('seed-one');
    const s2 = ensureSeed(s1, 'seed-two');
    expect(s2).toBe(s1); // same reference, no change
  });
});

describe('resolveHost', () => {
  it('elects the lowest-seat joined player when there is no host', () => {
    const state = initialRoomState('PIXW');
    const next = resolveHost(state, [conn('b', 2), conn('a', 1)]);
    expect(next.hostId).toBe('a');
  });

  it('keeps the current host while they are still seated', () => {
    const state = { ...initialRoomState('PIXW'), hostId: 'b' };
    const next = resolveHost(state, [conn('a', 0), conn('b', 1)]);
    expect(next).toBe(state); // unchanged — a new lower-seat joiner does not steal it
  });

  it('reassigns when the host leaves', () => {
    const state = { ...initialRoomState('PIXW'), hostId: 'a' };
    const next = resolveHost(state, [conn('b', 1), conn('c', 2)]);
    expect(next.hostId).toBe('b');
  });

  it('clears the host when the room empties', () => {
    const state = { ...initialRoomState('PIXW'), hostId: 'a' };
    expect(resolveHost(state, []).hostId).toBeNull();
  });
});

describe('issueNextRoll / currentRoll', () => {
  it('issues issueRoll(seed, round) and advances the round', () => {
    const state = { ...initialRoomState('PIXW'), roomSeed: 'seed-xyz', round: 0 };
    const a = issueNextRoll(state);
    expect(a.roll).toEqual(issueRoll('seed-xyz', 0));
    expect(a.state.round).toBe(1);

    const b = issueNextRoll(a.state);
    expect(b.roll).toEqual(issueRoll('seed-xyz', 1));
    expect(b.state.round).toBe(2);
  });

  it('is deterministic — same state in, same roll out', () => {
    const state = { ...initialRoomState('PIXW'), roomSeed: 'seed-xyz', round: 3 };
    expect(issueNextRoll(state).roll).toEqual(issueNextRoll(state).roll);
  });

  it('throws if asked to issue before a seed is set', () => {
    expect(() => issueNextRoll(initialRoomState('PIXW'))).toThrow(/roomSeed/);
  });

  it('currentRoll is null before the first roll, then the last one issued', () => {
    const fresh = { ...initialRoomState('PIXW'), roomSeed: 'seed-xyz', round: 0 };
    expect(currentRoll(fresh)).toBeNull();
    const after = issueNextRoll(fresh).state;
    expect(currentRoll(after)).toEqual(issueRoll('seed-xyz', 0));
  });
});

describe('presenceList / buildSnapshot', () => {
  const state = { ...initialRoomState('PIXW'), roomSeed: 'seed-xyz', round: 1, hostId: 'a' };
  const conns = [conn('b', 2, 'Bella'), conn('a', 0, 'Alex')];

  it('sorts players by seat and stamps isHost', () => {
    const players = presenceList(state, conns);
    expect(players.map((p) => p.id)).toEqual(['a', 'b']);
    expect(players[0]).toMatchObject({ id: 'a', seatIndex: 0, isHost: true, name: 'Alex' });
    expect(players[1]).toMatchObject({ id: 'b', seatIndex: 2, isHost: false });
  });

  it('snapshot carries mode, round, host and the current roll', () => {
    const snap = buildSnapshot(state, conns);
    expect(snap).toMatchObject({ code: 'PIXW', mode: 'same-board', round: 1, hostId: 'a' });
    expect(snap.currentRoll).toEqual(issueRoll('seed-xyz', 0));
    expect(snap.players).toHaveLength(2);
  });
});

describe('protocol / game-core fallback-face drift guard', () => {
  it('the protocol face enum matches game-core FALLBACK_FACE_IDS exactly', () => {
    // protocol mirrors these six by hand to avoid depending on game-core;
    // this test — at the one layer that sees both — is what keeps them equal.
    expect([...fallbackFaceSchema.options].sort()).toEqual([...FALLBACK_FACE_IDS].sort());
  });
});
