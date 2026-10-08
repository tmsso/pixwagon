import { describe, expect, it } from 'vitest';
import {
  createBoard,
  FALLBACK_BLOB_SIZES,
  fillCells,
  isComplete,
  issueRoll,
} from '@pixwagon/game-core';
import { FALLBACK_FACE_IDS } from '@pixwagon/game-core';
import type { Board, CellRef, CellState, MoveRejection } from '@pixwagon/game-core';
import {
  cellStateSchema,
  fallbackFaceSchema,
  MAX_PLAYERS,
  moveRejectionSchema,
  SKIP_WAITING_AFTER_MS,
  roomSnapshotSchema,
} from '@pixwagon/protocol';
import type { WireMoveChoice } from '@pixwagon/protocol';
import {
  admitSocket,
  awayPlayers,
  awaitingPlayers,
  buildSnapshot,
  closeRoundIfDone,
  ensureBoard,
  currentRoll,
  ensureSeed,
  findStaleConnection,
  initialRoomState,
  issueNextRoll,
  newlyFilled,
  nextFreeSeat,
  normaliseRoom,
  pickPicture,
  presenceList,
  reclaimIdentity,
  registerIdentity,
  resolveHost,
  roundBudgetFor,
  MAX_SOCKETS,
  PROVISIONAL_GRACE_MS,
  seatForJoin,
  skipWaiting,
  stampRoundStart,
  startGame,
  submitFill,
  submitPass,
  type RoomState,
  type SeatedConn,
} from './roomState.ts';

const conn = (id: string, seatIndex: number, name = id): SeatedConn => ({ id, name, seatIndex });

describe('nextFreeSeat', () => {
  it('returns the lowest unused seat', () => {
    expect(nextFreeSeat([])).toBe(0);
    expect(nextFreeSeat([0, 1, 3])).toBe(2);
    expect(nextFreeSeat([2, 0, 1])).toBe(3);
  });

  it('returns null once every seat is taken — never wraps onto a used seat', () => {
    const all = Array.from({ length: MAX_PLAYERS }, (_, i) => i);
    expect(nextFreeSeat(all)).toBeNull();
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

describe('reclaimIdentity', () => {
  it('resolves a known rejoin token to its stored identity', () => {
    const identity = { playerId: 'p1', seatIndex: 2, name: 'Alex' };
    const state = { ...initialRoomState('PIXW'), players: { 'token-1': identity } };
    expect(reclaimIdentity(state, 'token-1')).toEqual(identity);
  });

  it('returns null for an unsent token', () => {
    const state = initialRoomState('PIXW');
    expect(reclaimIdentity(state, undefined)).toBeNull();
  });

  it('returns null for a token the server does not recognise — never an error', () => {
    const state = initialRoomState('PIXW');
    expect(reclaimIdentity(state, 'nonexistent-token')).toBeNull();
  });
});

describe('registerIdentity', () => {
  it('records a new token → identity mapping', () => {
    const state = initialRoomState('PIXW');
    const identity = { playerId: 'p1', seatIndex: 0, name: 'Alex' };
    const next = registerIdentity(state, 'token-1', identity);
    expect(next.players).toEqual({ 'token-1': identity });
  });

  it('refreshes an existing mapping, e.g. after a display-name change', () => {
    const state = {
      ...initialRoomState('PIXW'),
      players: { 'token-1': { playerId: 'p1', seatIndex: 0, name: 'Alex' } },
    };
    const next = registerIdentity(state, 'token-1', { playerId: 'p1', seatIndex: 0, name: 'Al' });
    expect(next.players['token-1']).toMatchObject({ name: 'Al' });
  });

  it('is a same-reference no-op when the identity is unchanged — seat retention', () => {
    const identity = { playerId: 'p1', seatIndex: 3, name: 'Alex' };
    const state = { ...initialRoomState('PIXW'), players: { 'token-1': identity } };
    expect(registerIdentity(state, 'token-1', { ...identity })).toBe(state);
  });
});

describe('findStaleConnection', () => {
  it('finds a live connection already holding the reclaimed playerId', () => {
    const conns = [conn('p1', 0, 'Alex'), conn('p2', 1, 'Bella')];
    expect(findStaleConnection(conns, 'p1')).toEqual(conn('p1', 0, 'Alex'));
  });

  it('returns null when the reclaimed identity is not currently live', () => {
    const conns = [conn('p2', 1, 'Bella')];
    expect(findStaleConnection(conns, 'p1')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Phase 5 item 1 — per-player boards and the round lifecycle
// ---------------------------------------------------------------------------

/** A room with a seed, two seated players and the game started. */
function started(ids: readonly string[] = ['a', 'b'], seed = 'seed-p5'): RoomState {
  const result = startGame({ ...initialRoomState('TRAM'), roomSeed: seed }, ids);
  if (!result.ok) throw new Error('fixture failed to start');
  return result.state;
}

/**
 * A legal fallback choice for `board`: one horizontal run of fillable cells
 * per blob the face needs, never sharing a cell. Enough to drive the referee
 * without re-deriving placement search here.
 */
function fallbackBlobs(board: Board, sizes: readonly number[]): CellRef[][] {
  const used = new Set<string>();
  const blobs: CellRef[][] = [];
  for (const size of sizes) {
    let found: CellRef[] | null = null;
    for (let y = 0; y < board.size.height && !found; y += 1) {
      for (let x = 0; x + size <= board.size.width && !found; x += 1) {
        const run = Array.from({ length: size }, (_, i) => ({ x: x + i, y }));
        const ok = run.every(
          (c) =>
            board.cells[c.y * board.size.width + c.x] === 'fillable' && !used.has(`${c.x},${c.y}`),
        );
        if (ok) found = run;
      }
    }
    if (!found) throw new Error('no room left for a blob of ' + size);
    for (const c of found) used.add(`${c.x},${c.y}`);
    blobs.push(found);
  }
  return blobs;
}

/** A legal fill for `playerId` in the round currently in play. */
function legalFill(state: RoomState, playerId: string): WireMoveChoice {
  const roll = currentRoll(state)!;
  return {
    kind: 'fallback',
    blobs: fallbackBlobs(state.boards[playerId]!, FALLBACK_BLOB_SIZES[roll.fallback]),
  };
}

const allFilled = (board: Board): Board =>
  fillCells(
    board,
    board.cells.flatMap((cell, i) =>
      cell === 'fillable' ? [{ x: i % board.size.width, y: Math.floor(i / board.size.width) }] : [],
    ),
  );

describe('startGame', () => {
  it('picks a seeded picture, gives every player the same fresh board, fixes the budget, issues round 0', () => {
    const state = started(['a', 'b']);
    expect(state.status).toBe('playing');
    expect(state.pictureId).toBe(pickPicture('seed-p5', 'transportation'));
    const fresh = createBoard('transportation', state.pictureId!);
    expect(state.boards).toEqual({ a: fresh, b: fresh });
    // D3: ceil(fillable / 3) + 4, fixed at start.
    const fillable = fresh.cells.filter((c) => c !== 'blank').length;
    expect(state.roundBudget).toBe(Math.ceil(fillable / 3) + 4);
    expect(roundBudgetFor(fresh)).toBe(state.roundBudget);
    expect(state.round).toBe(1);
    expect(currentRoll(state)).toEqual(issueRoll('seed-p5', 0));
    expect(state.acted).toEqual([]);
  });

  it('the same seed always plays the same picture', () => {
    expect(pickPicture('seed-x', 'transportation')).toBe(pickPicture('seed-x', 'transportation'));
  });

  it('refuses a second start with game-in-progress', () => {
    expect(startGame(started(), ['a', 'b'])).toEqual({ ok: false, error: 'game-in-progress' });
  });
});

describe('ensureBoard', () => {
  it("gives a mid-game joiner a fresh board and leaves a rejoiner's board alone", () => {
    const state = started(['a']);
    const played = submitFill(state, 'a', 0, legalFill(state, 'a'));
    if (!played.ok) throw new Error('fixture fill rejected');
    const withNew = ensureBoard(played.state, 'z');
    expect(withNew.boards.z).toEqual(createBoard('transportation', state.pictureId!));
    expect(ensureBoard(withNew, 'a')).toBe(withNew);
  });

  it('is a no-op in the lobby', () => {
    const lobby = initialRoomState('TRAM');
    expect(ensureBoard(lobby, 'a')).toBe(lobby);
  });
});

describe('submitFill', () => {
  it('accepts a legal fill: stores the board, marks the player acted, reports the new cells', () => {
    const state = started();
    const result = submitFill(state, 'a', 0, legalFill(state, 'a'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.acted).toEqual(['a']);
    expect(result.state.boards.b).toBe(state.boards.b);
    expect(result.cells.length).toBe(
      FALLBACK_BLOB_SIZES[currentRoll(state)!.fallback].reduce((sum, n) => sum + n, 0),
    );
  });

  it("rejects an illegal fill with game-core's reason and does not count it as acting", () => {
    const state = started();
    // Cell (0, 0) is blank in every shipped picture's top-left corner.
    const result = submitFill(state, 'a', 0, { kind: 'fallback', blobs: [[{ x: 0, y: 0 }]] });
    expect(result).toMatchObject({ ok: false });
    expect('rejection' in result && result.rejection).toBeTruthy();
    expect(state.acted).toEqual([]);
  });

  it('rejects a fill for a round that is not in play as wrong-round', () => {
    const state = started();
    expect(submitFill(state, 'a', 5, legalFill(state, 'a'))).toEqual({
      ok: false,
      rejection: 'wrong-round',
    });
  });

  it('refuses a second action in the same round with already-acted', () => {
    const state = started();
    const first = submitFill(state, 'a', 0, legalFill(state, 'a'));
    if (!first.ok) throw new Error('fixture fill rejected');
    expect(submitFill(first.state, 'a', 0, legalFill(first.state, 'a'))).toEqual({
      ok: false,
      error: 'already-acted',
    });
    expect(submitPass(first.state, 'a', 0)).toEqual({ ok: false, error: 'already-acted' });
  });

  it('refuses fills before the game starts with not-playing', () => {
    const lobby = { ...initialRoomState('TRAM'), roomSeed: 's' };
    expect(submitFill(lobby, 'a', 0, { kind: 'fallback', blobs: [[{ x: 1, y: 1 }]] })).toEqual({
      ok: false,
      error: 'not-playing',
    });
  });
});

describe('tampered fills (Phase 5 item 4)', () => {
  // What a modified client could send that the roll cannot cover. Each must
  // be refused with nothing stored — no board change, not counted as acting,
  // and no cells for `room.ts` to broadcast as a `delta` (it broadcasts only
  // on `ok: true`; the live half of this is `pnpm tamper:check`).
  const state = started();
  const roll = currentRoll(state)!;
  const notOffered = (['monomino', 'domino', 'tromino-i', 'tromino-l'] as const).find(
    (id) => !roll.pair.includes(id as never),
  )!;
  const legal = legalFill(state, 'a');
  const allFillable = state.boards.a!.cells.flatMap((cell, i) =>
    cell === 'fillable'
      ? [{ x: i % state.boards.a!.size.width, y: Math.floor(i / state.boards.a!.size.width) }]
      : [],
  );

  const cases: [string, WireMoveChoice][] = [
    [
      'more cells than the fallback face allows',
      { kind: 'fallback', blobs: [allFillable.slice(0, 3), allFillable.slice(3, 6)] },
    ],
    [
      'a piece the pair did not offer',
      {
        kind: 'pair',
        placements: [
          {
            pieceId: notOffered,
            orientation: { rotation: 0, mirrored: false },
            origin: { x: 1, y: 1 },
          },
          {
            pieceId: roll.pair[1],
            orientation: { rotation: 0, mirrored: false },
            origin: { x: 4, y: 4 },
          },
        ],
      },
    ],
    [
      'an invented piece id',
      {
        kind: 'pair',
        placements: [
          {
            pieceId: 'mega-square',
            orientation: { rotation: 0, mirrored: false },
            origin: { x: 1, y: 1 },
          },
          {
            pieceId: roll.pair[1],
            orientation: { rotation: 0, mirrored: false },
            origin: { x: 4, y: 4 },
          },
        ],
      },
    ],
    ['cells off the board', { kind: 'fallback', blobs: [[{ x: 999, y: 999 }]] }],
  ];

  it.each(cases)('refuses %s and stores nothing', (_name, choice) => {
    const result = submitFill(state, 'a', 0, choice);
    expect(result.ok).toBe(false);
    expect('rejection' in result).toBe(true);
    expect(state.boards.a).toEqual(createBoard('transportation', state.pictureId!));
    expect(state.acted).toEqual([]);
  });

  it('the same cells sent as a legal choice are accepted — the refusals were about the choice', () => {
    expect(submitFill(state, 'a', 0, legal).ok).toBe(true);
  });
});

describe('submitPass', () => {
  it('counts as acting, and refuses a pass for a round that already closed', () => {
    const state = started();
    const passed = submitPass(state, 'a', 0);
    expect(passed).toMatchObject({ ok: true });
    if (passed.ok) expect(passed.state.acted).toEqual(['a']);
    expect(submitPass(state, 'a', 3)).toEqual({ ok: false, error: 'wrong-round' });
  });
});

describe('closeRoundIfDone', () => {
  it('waits while a connected player has not acted', () => {
    const state = started();
    const a = submitPass(state, 'a', 0);
    if (!a.ok) throw new Error('fixture');
    expect(awaitingPlayers(a.state, ['a', 'b'])).toEqual(['b']);
    expect(closeRoundIfDone(a.state, ['a', 'b'])).toEqual({ closed: false, state: a.state });
  });

  it('advances on its own once everyone connected has acted: scores, next roll, acted reset', () => {
    const state = started();
    const a = submitFill(state, 'a', 0, legalFill(state, 'a'));
    if (!a.ok) throw new Error('fixture');
    const b = submitPass(a.state, 'b', 0);
    if (!b.ok) throw new Error('fixture');
    const closing = closeRoundIfDone(b.state, ['a', 'b']);
    expect(closing.closed).toBe(true);
    if (!closing.closed) return;
    expect(closing.sessionEnded).toBe(false);
    expect(closing.result.round).toBe(0);
    expect(closing.result.scores.map((sc) => sc.playerId).sort()).toEqual(['a', 'b']);
    expect(closing.roll).toEqual(issueRoll('seed-p5', 1));
    expect(closing.state.round).toBe(2);
    expect(closing.state.acted).toEqual([]);
  });

  it('skips a player who disconnected: the round closes when the last straggler drops (D2)', () => {
    const state = started();
    const a = submitPass(state, 'a', 0);
    if (!a.ok) throw new Error('fixture');
    // `b` never acted, then left — the reconcile path calls this with only `a`.
    const closing = closeRoundIfDone(a.state, ['a']);
    expect(closing.closed).toBe(true);
    // ...and `b`'s board is kept for when they come back.
    expect(closing.state.boards.b).toBeDefined();
  });

  it('never waits on a player whose picture is already complete', () => {
    const state = started();
    const done = { ...state, boards: { ...state.boards, b: allFilled(state.boards.b!) } };
    expect(awaitingPlayers(done, ['a', 'b'])).toEqual(['a']);
  });

  it('does not advance an empty room', () => {
    const state = started();
    expect(closeRoundIfDone(state, [])).toEqual({ closed: false, state });
  });

  it('ends the session when the round budget is spent (D3)', () => {
    const state = { ...started(), roundBudget: 1 };
    const a = submitPass(state, 'a', 0);
    const b = a.ok ? submitPass(a.state, 'b', 0) : a;
    if (!b.ok) throw new Error('fixture');
    const closing = closeRoundIfDone(b.state, ['a', 'b']);
    expect(closing).toMatchObject({ closed: true, sessionEnded: true });
    if (closing.closed) {
      expect(closing.roll).toBeUndefined();
      expect(closing.state.status).toBe('ended');
    }
  });

  it('ends the session when every board is complete, with a complete result', () => {
    const state = started();
    const full = {
      ...state,
      boards: { a: allFilled(state.boards.a!), b: allFilled(state.boards.b!) },
    };
    const closing = closeRoundIfDone(full, ['a', 'b']);
    expect(closing).toMatchObject({ closed: true, sessionEnded: true });
    if (closing.closed) expect(closing.result.complete).toBe(true);
  });

  it('ends rather than spinning empty rounds when only an absent player is incomplete', () => {
    const state = started();
    const onlyAbsentLeft = { ...state, boards: { ...state.boards, a: allFilled(state.boards.a!) } };
    const closing = closeRoundIfDone(onlyAbsentLeft, ['a']);
    expect(closing).toMatchObject({ closed: true, sessionEnded: true });
    if (closing.closed) expect(closing.result.complete).toBe(false);
  });
});

describe('snapshot and storage', () => {
  it("a started room's snapshot passes the wire schema, boards included", () => {
    const snap = buildSnapshot(started(), [conn('a', 0), conn('b', 1)]);
    expect(roomSnapshotSchema.safeParse(snap).success).toBe(true);
    expect(snap.status).toBe('playing');
    expect(Object.keys(snap.boards).sort()).toEqual(['a', 'b']);
  });

  it('normaliseRoom loads pre-Phase-5 storage as a lobby, keeping what it had', () => {
    const legacy = {
      code: 'TRAM',
      mode: 'same-board' as const,
      roomSeed: 's',
      round: 2,
      hostId: 'a',
      players: {},
    };
    const room = normaliseRoom(legacy);
    expect(room).toMatchObject({
      ...legacy,
      status: 'lobby',
      boards: {},
      acted: [],
      pictureId: null,
    });
  });
});

describe('delta / game-core Board drift guard', () => {
  it("folding a delta's cells into the old board gives exactly the board the referee stored", () => {
    // Over several seeds and rounds: whatever `submitFill` reports as the
    // delta, `fillCells(before, delta)` must reproduce the stored board —
    // the client (Phase 5 item 3) will rebuild other players' boards this way.
    for (const seed of ['d1', 'd2', 'd3', 'd4']) {
      let state = started(['a'], seed);
      for (let round = 0; round < 5 && state.status === 'playing'; round += 1) {
        const before = state.boards.a!;
        const result = submitFill(state, 'a', currentRoll(state)!.round, legalFill(state, 'a'));
        if (!result.ok) throw new Error('fixture fill rejected');
        expect(fillCells(before, result.cells)).toEqual(result.state.boards.a);
        expect(newlyFilled(before, result.state.boards.a!)).toEqual(result.cells);
        const closing = closeRoundIfDone(result.state, ['a']);
        state = closing.state;
        if (isComplete(state.boards.a!)) break;
      }
    }
  });
});

describe('protocol / game-core enum drift guards (Phase 5)', () => {
  it('cellStateSchema matches game-core CellState', () => {
    // `satisfies Record<CellState, true>` fails to compile if game-core gains
    // or loses a state; the equality below fails if protocol's copy differs.
    const states = { blank: true, fillable: true, filled: true, locked: true } satisfies Record<
      CellState,
      true
    >;
    expect([...cellStateSchema.options].sort()).toEqual(Object.keys(states).sort());
  });

  it('moveRejectionSchema matches game-core MoveRejection', () => {
    const reasons = {
      'wrong-round': true,
      'unknown-piece': true,
      'out-of-bounds': true,
      'cell-not-fillable': true,
      'cell-already-filled': true,
      'overlapping-placement': true,
      'not-offered': true,
      'blob-size-mismatch': true,
      'blob-not-contiguous': true,
      'incomplete-compound-choice': true,
    } satisfies Record<MoveRejection, true>;
    expect([...moveRejectionSchema.options].sort()).toEqual(Object.keys(reasons).sort());
  });
});

describe('seats under more than six sockets (2026-10-08 hardening)', () => {
  const six = Array.from({ length: MAX_PLAYERS }, (_, i) => conn(`p${i}`, i));

  it("a seventh joiner is refused instead of sharing someone else's seat", () => {
    const state = initialRoomState('TRAM');
    expect(seatForJoin(state, six, 'p-new')).toBeNull();
  });

  it('every seat handed to six successive joiners is distinct', () => {
    let state = initialRoomState('TRAM');
    const live: SeatedConn[] = [];
    for (let i = 0; i < MAX_PLAYERS; i += 1) {
      const seat = seatForJoin(state, live, `p${i}`);
      expect(seat).not.toBeNull();
      live.push(conn(`p${i}`, seat!));
      state = registerIdentity(state, `tok${i}`, {
        playerId: `p${i}`,
        seatIndex: seat!,
        name: 'x',
      });
    }
    expect(new Set(live.map((c) => c.seatIndex)).size).toBe(MAX_PLAYERS);
  });

  it('a rejoiner gets their old seat back, or the lowest free one if it was taken', () => {
    const state = initialRoomState('TRAM');
    expect(seatForJoin(state, [conn('b', 1)], 'a', 3)).toBe(3);
    expect(seatForJoin(state, [conn('b', 3)], 'a', 3)).toBe(0);
    // A stale live socket of the same player never blocks their own seat.
    expect(seatForJoin(state, [conn('a', 3)], 'a', 3)).toBe(3);
  });

  it("an away player's seat stays reserved mid-game, but not in the lobby", () => {
    const lobby = registerIdentity(initialRoomState('TRAM'), 'tok-a', {
      playerId: 'a',
      seatIndex: 0,
      name: 'Alex',
    });
    expect(seatForJoin(lobby, [conn('b', 1)], 'c')).toBe(0);

    const playing = registerIdentity(started(['a', 'b']), 'tok-a', {
      playerId: 'a',
      seatIndex: 0,
      name: 'Alex',
    });
    expect(seatForJoin(playing, [conn('b', 1)], 'c')).toBe(2);
    // ...and the away player reclaims it.
    expect(seatForJoin(playing, [conn('b', 1)], 'a', 0)).toBe(0);
  });
});

describe('admitSocket', () => {
  const now = 1_000_000;
  const joined = (n: number) => Array.from({ length: n }, () => ({ joined: true, acceptedAt: 0 }));

  it('admits below the cap without evicting anything', () => {
    expect(admitSocket(joined(MAX_SOCKETS - 1), now)).toEqual({ admit: true, evict: [] });
  });

  it('at the cap, evicts idle never-joined sockets past the grace period to make room', () => {
    const idle = { joined: false, acceptedAt: now - PROVISIONAL_GRACE_MS };
    const fresh = { joined: false, acceptedAt: now - 1 };
    const sockets = [...joined(MAX_SOCKETS - 2), idle, fresh];
    expect(admitSocket(sockets, now)).toEqual({ admit: true, evict: [idle] });
  });

  it('refuses when the cap is all joined players or sockets still inside their grace', () => {
    expect(admitSocket(joined(MAX_SOCKETS), now).admit).toBe(false);
    const young = Array.from({ length: MAX_SOCKETS }, () => ({ joined: false, acceptedAt: now }));
    expect(admitSocket(young, now)).toEqual({ admit: false, evict: [] });
  });
});

describe('presence with away players (protocol 2)', () => {
  const withIdentities = (state: RoomState): RoomState =>
    registerIdentity(
      registerIdentity(state, 'tok-a', { playerId: 'a', seatIndex: 0, name: 'Alex' }),
      'tok-b',
      { playerId: 'b', seatIndex: 1, name: 'Bella' },
    );

  it('lists a disconnected board-holder as connected:false, sorted by seat', () => {
    const state = { ...withIdentities(started(['a', 'b'])), hostId: 'b' };
    const players = presenceList(state, [conn('b', 1, 'Bella')]);
    expect(players).toEqual([
      { id: 'a', name: 'Alex', seatIndex: 0, isHost: false, connected: false },
      { id: 'b', name: 'Bella', seatIndex: 1, isHost: true, connected: true },
    ]);
    expect(awayPlayers(state, [conn('b', 1)]).map((p) => p.playerId)).toEqual(['a']);
  });

  it('someone who left a lobby is simply gone', () => {
    const state = withIdentities(initialRoomState('TRAM'));
    expect(presenceList(state, [conn('b', 1, 'Bella')]).map((p) => p.id)).toEqual(['b']);
  });

  it('the snapshot validates against the protocol 2 schema', () => {
    const state = withIdentities(started(['a', 'b']));
    expect(roomSnapshotSchema.safeParse(buildSnapshot(state, [conn('b', 1)])).success).toBe(true);
  });
});

describe('skipWaiting', () => {
  const t0 = 5_000_000;
  const stamped = (state: RoomState): RoomState => ({ ...state, roundStartedAt: t0 });

  it('is too early before SKIP_WAITING_AFTER_MS, then passes everyone still awaited', () => {
    const state = stamped(started(['a', 'b', 'c']));
    const a = submitPass(state, 'a', 0);
    if (!a.ok) throw new Error('fixture');
    expect(skipWaiting(a.state, ['a', 'b', 'c'], 0, t0 + SKIP_WAITING_AFTER_MS - 1)).toEqual({
      ok: false,
      error: 'too-early',
    });
    const skip = skipWaiting(a.state, ['a', 'b', 'c'], 0, t0 + SKIP_WAITING_AFTER_MS);
    expect(skip).toMatchObject({ ok: true, skipped: ['b', 'c'] });
    if (!skip.ok) return;
    // ...which lets the round close on its own.
    expect(closeRoundIfDone(skip.state, ['a', 'b', 'c']).closed).toBe(true);
  });

  it('refuses a stale round and a room that is not playing', () => {
    const state = stamped(started());
    expect(skipWaiting(state, ['a', 'b'], 4, t0 + SKIP_WAITING_AFTER_MS)).toEqual({
      ok: false,
      error: 'wrong-round',
    });
    expect(skipWaiting(initialRoomState('TRAM'), ['a'], 0, t0)).toEqual({
      ok: false,
      error: 'not-playing',
    });
  });

  it('lets an unstamped (pre-protocol-2) round be skipped rather than stall', () => {
    expect(skipWaiting(started(), ['a', 'b'], 0, 0)).toMatchObject({ ok: true });
  });
});

describe('stampRoundStart', () => {
  it('stamps only when the round advanced', () => {
    const before = started();
    expect(stampRoundStart(before, before, 42)).toBe(before);
    const after = { ...before, round: before.round + 1 };
    expect(stampRoundStart(before, after, 42).roundStartedAt).toBe(42);
  });
});
