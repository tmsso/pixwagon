import { describe, expect, it } from 'vitest';
import type { PlayerPresence, RoomSnapshot } from '@pixwagon/protocol';
import { createBoard, fillCells } from '@pixwagon/game-core';
import type { Board } from '@pixwagon/game-core';
import { SKIP_WAITING_AFTER_MS } from '@pixwagon/protocol';
import {
  canSkipWaiting,
  connectionPill,
  roomPhase,
  roomRanking,
  startBlockedReason,
  waitingLine,
  waitingOn,
  waitingStatus,
} from './roomView.ts';

const seat = (i: number): PlayerPresence => ({
  id: `p${i}`,
  name: `P${i}`,
  seatIndex: i,
  isHost: i === 0,
  connected: true,
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
  const roll = { round: 0, seed: 's', pair: ['a', 'b'] as const, fallback: '1' as const };

  it('follows the server status: joining, waiting, playing, ended', () => {
    expect(roomPhase(null)).toBe('joining');
    expect(roomPhase(waiting)).toBe('waiting');
    expect(roomPhase({ ...waiting, status: 'playing', round: 1, currentRoll: roll })).toBe(
      'playing',
    );
    expect(roomPhase({ ...waiting, status: 'ended', round: 1, currentRoll: roll })).toBe('ended');
  });

  it('a pre-Phase-5 room (lobby with a roll present) is still the waiting room', () => {
    expect(roomPhase({ ...waiting, round: 1, currentRoll: roll })).toBe('waiting');
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

describe('in-game views (Phase 5 item 3)', () => {
  const board = createBoard('transportation', 'tram');
  const fillable = board.cells.flatMap((cell, i) =>
    cell === 'fillable' ? [{ x: i % board.size.width, y: Math.floor(i / board.size.width) }] : [],
  );
  const full: Board = fillCells(board, fillable);
  const some: Board = fillCells(board, fillable.slice(0, 5));
  const away = { ...seat(2), connected: false };
  const game: RoomSnapshot = {
    ...waiting,
    status: 'playing',
    round: 1,
    currentRoll: { round: 0, seed: 's', pair: ['a', 'b'], fallback: '1' },
    players: [seat(0), seat(1), away, seat(3)],
    boards: { p0: board, p1: board, p2: board, p3: full },
    acted: ['p1'],
  };

  it('waits on connected, unacted, unfinished players only', () => {
    // p1 acted, p2 is away, p3's picture is complete.
    expect(waitingOn(game)).toEqual(['p0']);
    expect(waitingLine(game, 'p1')).toBe('Waiting for P0');
    expect(waitingLine(game, 'p0')).toBeNull();
    expect(waitingLine({ ...game, acted: [] }, 'p3')).toBe('Waiting for P0 and P1');
  });

  it('offers the host a skip only after the wait, and only for someone else', () => {
    const t = 1_000;
    const g = { ...game, acted: ['p0'], boards: { ...game.boards, p1: board } };
    const waitingForP1 = { ...g, acted: ['p0'] };
    expect(canSkipWaiting(waitingForP1, host, t, t + SKIP_WAITING_AFTER_MS - 1)).toBe(false);
    expect(canSkipWaiting(waitingForP1, host, t, t + SKIP_WAITING_AFTER_MS)).toBe(true);
    expect(canSkipWaiting(waitingForP1, guest, t, t + SKIP_WAITING_AFTER_MS)).toBe(false);
    // Only the host themself left to act: nothing to skip.
    expect(canSkipWaiting({ ...g, acted: ['p1'] }, host, t, t + SKIP_WAITING_AFTER_MS)).toBe(false);
  });

  it('ranks complete pictures first, then filled squares; ties share a rank', () => {
    const ended = {
      ...game,
      status: 'ended' as const,
      boards: { p0: some, p1: full, p2: some, p3: board },
    };
    const ranking = roomRanking(ended);
    expect(ranking.map((r) => [r.playerId, r.rank])).toEqual([
      ['p1', 1],
      ['p0', 2],
      ['p2', 2],
      ['p3', 4],
    ]);
    expect(ranking[0]).toMatchObject({ complete: true, name: 'P1' });
    expect(ranking[0]!.points).toBeGreaterThan(0);
  });
});
