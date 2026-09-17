import { issueRoll } from '@pixwagon/game-core';
import type { Roll } from '@pixwagon/game-core';
import {
  MAX_PLAYERS,
  type GameMode,
  type PlayerPresence,
  type RoomSnapshot,
} from '@pixwagon/protocol';

/**
 * The room's shared state, and every decision that touches it — kept pure so it
 * runs in a plain Node test without a Workers pool. `room.ts` is the thin
 * Durable Object glue that reads/writes this through `state.storage` (never an
 * instance field: hibernation may evict the object while sockets stay open) and
 * fans messages out over the sockets.
 *
 * Same discipline as `game-core` being pure and `env.ts` holding the seat count
 * before it moved to `protocol`: the logic that must not disagree between
 * phases lives somewhere it can be tested directly.
 */

export interface RoomState {
  code: string;
  mode: GameMode;
  /**
   * Set exactly once, on the first join. `issueRoll(roomSeed, round)` — which
   * calls `deriveSeed(roomSeed, round)` and nothing else — drives every round's
   * offer, so a late joiner reconstructs round N without replaying 0..N-1
   * (docs/contracts/rng.md).
   */
  roomSeed: string | null;
  /** Rolls issued so far. 0 = the host has not started. `request-roll` issues
   *  `issueRoll(roomSeed, round)` then bumps this. */
  round: number;
  /** The one connection allowed to issue rolls — the lowest-seat joined player,
   *  recomputed on every join/leave. `null` when the room is empty. */
  hostId: string | null;
  /**
   * `rejoinToken -> identity`, so a reconnect keeps the same `playerId` and
   * seat instead of looking like a brand-new player (Phase 4 item 2). A
   * token is minted on first join and returned in `welcome`; the client
   * resends it on reconnect. Never pruned in v1 — a room's storage is small
   * and a room's lifetime is short, so an expiry policy is future work, not
   * a blocker here.
   */
  players: Record<string, StoredPlayer>;
}

/** The identity a rejoin token resolves to. */
export interface StoredPlayer {
  playerId: string;
  seatIndex: number;
  name: string;
}

/** A joined connection, reduced to what room-state decisions need. */
export interface SeatedConn {
  id: string;
  name: string;
  seatIndex: number;
}

export function initialRoomState(code: string): RoomState {
  return { code, mode: 'same-board', roomSeed: null, round: 0, hostId: null, players: {} };
}

/**
 * Lowest free seat in `0..MAX_PLAYERS-1`. Derived from the live sockets' seats,
 * never an incrementing counter — a counter restarts at 0 after a hibernation
 * eviction and hands a joiner a seat (hue + hatch) someone is still using.
 */
export function nextFreeSeat(taken: readonly number[]): number {
  const set = new Set(taken);
  for (let seat = 0; seat < MAX_PLAYERS; seat += 1) {
    if (!set.has(seat)) return seat;
  }
  return taken.length % MAX_PLAYERS;
}

export function roomIsFull(joinedCount: number): boolean {
  return joinedCount >= MAX_PLAYERS;
}

/** Fills `roomSeed` on the first join; a no-op (same reference) afterwards. */
export function ensureSeed(state: RoomState, seed: string): RoomState {
  return state.roomSeed === null ? { ...state, roomSeed: seed } : state;
}

/**
 * Resolve a `join`'s `rejoinToken` against stored identities. `undefined`
 * (no token sent) or a token the server doesn't recognise (room storage
 * reset, wrong room, a typo) both resolve to `null` — the caller treats
 * either the same as a fresh join, never an error.
 */
export function reclaimIdentity(state: RoomState, token: string | undefined): StoredPlayer | null {
  if (token === undefined) return null;
  return state.players[token] ?? null;
}

/**
 * Record (or refresh) a token's identity, e.g. after a display-name change.
 * Same-reference no-op when nothing changed, matching `ensureSeed` /
 * `resolveHost`'s convention.
 */
export function registerIdentity(
  state: RoomState,
  token: string,
  identity: StoredPlayer,
): RoomState {
  const existing = state.players[token];
  if (
    existing &&
    existing.playerId === identity.playerId &&
    existing.seatIndex === identity.seatIndex &&
    existing.name === identity.name
  ) {
    return state;
  }
  return { ...state, players: { ...state.players, [token]: identity } };
}

/**
 * The already-live connection holding `playerId`, if any — a rejoin that
 * reclaims an identity still connected elsewhere (e.g. a tab that never
 * cleanly closed) needs to evict it rather than create a duplicate seat.
 * Pure over the connection list so it's testable without a real socket;
 * `room.ts` is the one that actually closes it.
 */
export function findStaleConnection(
  conns: readonly SeatedConn[],
  playerId: string,
): SeatedConn | null {
  return conns.find((c) => c.id === playerId) ?? null;
}

/**
 * Host = the lowest-seat joined player. Keeps the current host while they are
 * still seated (so a new joiner never steals it), reassigns when they leave,
 * clears to `null` when the room empties. Returns the same reference when
 * nothing changed.
 */
export function resolveHost(state: RoomState, conns: readonly SeatedConn[]): RoomState {
  if (conns.length === 0) {
    return state.hostId === null ? state : { ...state, hostId: null };
  }
  const currentStillSeated = state.hostId !== null && conns.some((c) => c.id === state.hostId);
  if (currentStillSeated) return state;
  const lowest = [...conns].sort((a, b) => a.seatIndex - b.seatIndex)[0]!;
  return lowest.id === state.hostId ? state : { ...state, hostId: lowest.id };
}

/**
 * Issue the next round's roll and advance. Pure: identical `state` in →
 * identical `roll` and next `state` out, so two clients that (somehow) trigger
 * the same round get the same offer. Caller persists the returned state before
 * broadcasting the roll.
 */
export function issueNextRoll(state: RoomState): { roll: Roll; state: RoomState } {
  if (state.roomSeed === null) {
    throw new Error('issueNextRoll called before roomSeed was set');
  }
  const roll = issueRoll(state.roomSeed, state.round);
  return { roll, state: { ...state, round: state.round + 1 } };
}

/** The roll currently in play — the last one issued — or `null` before the
 *  host has started. Recomputable from `roomSeed` + `round` alone. */
export function currentRoll(state: RoomState): Roll | null {
  if (state.roomSeed === null || state.round === 0) return null;
  return issueRoll(state.roomSeed, state.round - 1);
}

/** `presence` payload / a snapshot's `players`, sorted by seat and stamped with
 *  `isHost` from the resolved state. */
export function presenceList(state: RoomState, conns: readonly SeatedConn[]): PlayerPresence[] {
  return [...conns]
    .sort((a, b) => a.seatIndex - b.seatIndex)
    .map((c) => ({
      id: c.id,
      name: c.name,
      seatIndex: c.seatIndex,
      isHost: c.id === state.hostId,
    }));
}

/** The full snapshot sent on `join` and after a resync. */
export function buildSnapshot(state: RoomState, conns: readonly SeatedConn[]): RoomSnapshot {
  return {
    code: state.code,
    mode: state.mode,
    round: state.round,
    currentRoll: currentRoll(state),
    hostId: state.hostId,
    players: presenceList(state, conns),
  };
}
