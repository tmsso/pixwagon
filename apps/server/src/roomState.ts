import {
  applyMove,
  createBoard,
  createRng,
  deriveSeed,
  isComplete,
  issueRoll,
  scoreRound,
} from '@pixwagon/game-core';
import type {
  Board,
  CellRef,
  MoveChoice,
  MoveRejection,
  Roll,
  RoundResult,
} from '@pixwagon/game-core';
import { getPack } from '@pixwagon/packs';
import {
  MAX_PLAYERS,
  type GameMode,
  type PlayerPresence,
  type RoomSnapshot,
  type WireMoveChoice,
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

  // --- Phase 5: the game itself (D1(a) per-player copies, D2 simultaneous
  // rounds, D3 one picture per session with a round budget) ---------------

  /** `lobby` → (host starts) → `playing` → (all complete / budget) → `ended`. */
  status: GameStatus;
  /** The only pack until Phase 8 adds a second. */
  packId: string;
  /** Picked at start from `deriveSeed(roomSeed, 'pictures')`, so reproducible. */
  pictureId: string | null;
  /** `ceil(fillableCells / 3) + 4` rolls (D3), stored at start, never recomputed. */
  roundBudget: number | null;
  /** One board per player id — kept when the player disconnects (their
   *  squares stay, pass 02 Annotation 19) and reclaimed on rejoin. */
  boards: Record<string, Board>;
  /** Player ids that filled or passed in the round in play. */
  acted: string[];
}

export type GameStatus = 'lobby' | 'playing' | 'ended';

/** Until Phase 8 ships a second pack, every room plays this one. */
export const DEFAULT_PACK_ID = 'transportation';

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
  return {
    code,
    mode: 'same-board',
    roomSeed: null,
    round: 0,
    hostId: null,
    players: {},
    status: 'lobby',
    packId: DEFAULT_PACK_ID,
    pictureId: null,
    roundBudget: null,
    boards: {},
    acted: [],
  };
}

/**
 * Room storage written before Phase 5 has none of the game fields; a Durable
 * Object's storage outlives deploys, so an old room must still load. Every
 * Phase 5 field is additive with a lobby default, so filling the gaps from
 * `initialRoomState` is the whole migration.
 */
export function normaliseRoom(stored: Partial<RoomState> & { code: string }): RoomState {
  return { ...initialRoomState(stored.code), ...stored };
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

// ---------------------------------------------------------------------------
// Phase 5 — the round lifecycle (D2: simultaneous rounds, auto-advance)
// ---------------------------------------------------------------------------

/** The picture a session plays — a seeded pick, so the same `roomSeed`
 *  always plays the same picture (docs/contracts/rng.md: derive, never draw
 *  from a shared stream). */
export function pickPicture(roomSeed: string, packId: string): string {
  const pack = getPack(packId);
  if (!pack) throw new Error(`unknown pack "${packId}"`);
  return createRng(deriveSeed(roomSeed, 'pictures')).pick(pack.pictures).id;
}

/** D3's budget: roughly the fillable cells over a typical fallback fill, plus
 *  slack. */
export function roundBudgetFor(board: Board): number {
  const fillable = board.cells.filter((cell) => cell !== 'blank').length;
  return Math.ceil(fillable / 3) + 4;
}

export type StartResult =
  { ok: true; state: RoomState; roll: Roll } | { ok: false; error: 'game-in-progress' };

/**
 * The host's one per-game action (D2): pick the picture, give every seated
 * player a board, fix the budget, issue round 0. Only from `lobby` — once
 * running, rounds advance on their own.
 */
export function startGame(state: RoomState, playerIds: readonly string[]): StartResult {
  if (state.status !== 'lobby') return { ok: false, error: 'game-in-progress' };
  if (state.roomSeed === null) throw new Error('startGame called before roomSeed was set');

  const pictureId = pickPicture(state.roomSeed, state.packId);
  const fresh = createBoard(state.packId, pictureId);
  const boards: Record<string, Board> = {};
  for (const id of playerIds) boards[id] = fresh;

  const started: RoomState = {
    ...state,
    status: 'playing',
    pictureId,
    roundBudget: roundBudgetFor(fresh),
    boards,
    acted: [],
  };
  const { roll, state: next } = issueNextRoll(started);
  return { ok: true, state: next, roll };
}

/**
 * A player joining a game already under way gets a fresh board and plays from
 * the current round (a rejoiner already has one and keeps it). Same-reference
 * no-op otherwise.
 */
export function ensureBoard(state: RoomState, playerId: string): RoomState {
  if (state.status !== 'playing' || state.pictureId === null || state.boards[playerId]) {
    return state;
  }
  return {
    ...state,
    boards: { ...state.boards, [playerId]: createBoard(state.packId, state.pictureId) },
  };
}

export type ActionError = 'not-playing' | 'already-acted';

export type FillResult =
  | { ok: true; state: RoomState; cells: CellRef[] }
  | { ok: false; error: ActionError }
  | { ok: false; rejection: MoveRejection };

/** Cells `after` has filled that `before` did not — exactly a `delta`. */
export function newlyFilled(before: Board, after: Board): CellRef[] {
  const cells: CellRef[] = [];
  after.cells.forEach((cell, index) => {
    if (cell !== before.cells[index]) {
      cells.push({ x: index % after.size.width, y: Math.floor(index / after.size.width) });
    }
  });
  return cells;
}

/**
 * The wire's move choice as game-core's. The only difference is the brand on
 * `pieceId`: the wire validates it as a non-empty string and leaves "is this a
 * real piece" to `applyMove`, which rejects an unknown one as `unknown-piece`
 * — so the cast asserts nothing the referee doesn't then check.
 */
function toMoveChoice(choice: WireMoveChoice): MoveChoice {
  return choice as MoveChoice;
}

/**
 * The referee's ruling on one `fill`. A rejected fill does not count as
 * acting — the player may try again this round; an accepted one does.
 */
export function submitFill(
  state: RoomState,
  playerId: string,
  round: number,
  choice: WireMoveChoice,
): FillResult {
  const roll = currentRoll(state);
  const board = state.boards[playerId];
  if (state.status !== 'playing' || !roll || !board) return { ok: false, error: 'not-playing' };
  if (state.acted.includes(playerId)) return { ok: false, error: 'already-acted' };

  const result = applyMove(board, roll, { playerId, round, choice: toMoveChoice(choice) });
  if (!result.ok) return { ok: false, rejection: result.reason };

  return {
    ok: true,
    cells: newlyFilled(board, result.board),
    state: {
      ...state,
      boards: { ...state.boards, [playerId]: result.board },
      acted: [...state.acted, playerId],
    },
  };
}

export type PassResult =
  { ok: true; state: RoomState } | { ok: false; error: ActionError | 'wrong-round' };

/**
 * Nothing this round. Allowed whether or not a legal move exists: declining
 * only costs the player who does it, so the referee has nothing to protect.
 * A stale `round` (a pass meant for a round that already closed) is refused
 * rather than silently spent on the next one.
 */
export function submitPass(state: RoomState, playerId: string, round: number): PassResult {
  const roll = currentRoll(state);
  if (state.status !== 'playing' || !roll || !state.boards[playerId]) {
    return { ok: false, error: 'not-playing' };
  }
  if (state.acted.includes(playerId)) return { ok: false, error: 'already-acted' };
  if (round !== roll.round) return { ok: false, error: 'wrong-round' };
  return { ok: true, state: { ...state, acted: [...state.acted, playerId] } };
}

/**
 * Connected players the round is still waiting on. A player whose board is
 * already complete has nothing left to place and is never waited on; a
 * disconnected player is skipped for the round (D2).
 */
export function awaitingPlayers(state: RoomState, connectedIds: readonly string[]): string[] {
  return connectedIds.filter((id) => {
    const board = state.boards[id];
    return board !== undefined && !isComplete(board) && !state.acted.includes(id);
  });
}

export type CloseRoundResult =
  | { closed: false; state: RoomState }
  | {
      closed: true;
      state: RoomState;
      result: RoundResult;
      sessionEnded: boolean;
      /** The next round's roll — absent when the session just ended. */
      roll?: Roll;
    };

/**
 * Close the round once nobody connected is still owed an action, then either
 * issue the next roll or end the session (D3): every board complete, the
 * budget spent, or nobody connected has anything left to place (without that
 * last clause a room whose only incomplete board belongs to someone who left
 * would advance forever on empty rounds). Called after every fill, pass, join
 * and disconnect — the disconnect case is what lets a round close when its
 * last straggler drops. An empty room never advances: no one is there to see
 * it, and the next joiner should find the round they left.
 */
export function closeRoundIfDone(
  state: RoomState,
  connectedIds: readonly string[],
): CloseRoundResult {
  const seated = connectedIds.filter((id) => state.boards[id] !== undefined);
  if (state.status !== 'playing' || seated.length === 0) return { closed: false, state };
  if (awaitingPlayers(state, connectedIds).length > 0) return { closed: false, state };

  const result = scoreRound(state.round - 1, state.boards);
  const nothingLeftHere = seated.every((id) => isComplete(state.boards[id]!));
  const sessionEnded =
    result.complete || nothingLeftHere || state.round >= (state.roundBudget ?? 0);

  if (sessionEnded) {
    return { closed: true, state: { ...state, status: 'ended' }, result, sessionEnded };
  }
  const { roll, state: next } = issueNextRoll({ ...state, acted: [] });
  return { closed: true, state: next, result, sessionEnded, roll };
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
    status: state.status,
    pictureId: state.pictureId,
    roundBudget: state.roundBudget,
    boards: state.boards,
    acted: state.acted,
  };
}
