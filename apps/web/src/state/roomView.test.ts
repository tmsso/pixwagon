import { describe, expect, it } from 'vitest';
import type { PlayerPresence, RoomSnapshot } from '@pixwagon/protocol';
import { connectionPill, roomPhase, startBlockedReason, waitingStatus } from './roomView.ts';

const seat = (i: number): PlayerPresence => ({
  id: `p${i}`,
  name: `P${i}`,
  seatIndex: i,
  isHost: i === 0,
});

const waiting: RoomSnapshot = {
  code: 'TRAM',
  mode: 'same-board',
  round: 0,
  currentRoll: null,
  hostId: 'p0',
  players: [seat(0)],
  status: 'lobby',
  pictureId: null,
  roundBudget: null,
  boards: {},
  acted: [],
};

const host = { playerId: 'p0', isHost: true };
const guest = { playerId: 'p1', isHost: false };

describe('roomPhase', () => {
  it('is joining before any snapshot, waiting before the first roll, playing after', () => {
    expect(roomPhase(null)).toBe('joining');
    expect(roomPhase(waiting)).toBe('waiting');
    expect(
      roomPhase({
        ...waiting,
        round: 1,
        currentRoll: { round: 0, seed: 's', pair: ['a', 'b'], fallback: '1' },
      }),
    ).toBe('playing');
  });
});

describe('startBlockedReason', () => {
  it('blocks a lone host and every non-host, frees a host with company', () => {
    expect(startBlockedReason(waiting, host)).toBe('Needs one more player');
    const two = { ...waiting, players: [seat(0), seat(1)] };
    expect(startBlockedReason(two, host)).toBeNull();
    expect(startBlockedReason(two, guest)).toBe('Only the host can start');
    expect(startBlockedReason(two, null)).toBe('Only the host can start');
  });
});

describe('waitingStatus', () => {
  it('names the empty and full rooms and says nothing in between', () => {
    expect(waitingStatus(waiting)).toBe('Waiting for someone to join.');
    expect(waitingStatus({ ...waiting, players: [seat(0), seat(1)] })).toBeNull();
    const full = { ...waiting, players: [0, 1, 2, 3, 4, 5].map(seat) };
    expect(waitingStatus(full)).toMatch(/Room is full/);
  });
});

describe('connectionPill', () => {
  it('maps idle to offline and passes the live states through', () => {
    expect(connectionPill('idle')).toBe('offline');
    expect(connectionPill('reconnecting')).toBe('reconnecting');
    expect(connectionPill('online')).toBe('online');
  });
});
