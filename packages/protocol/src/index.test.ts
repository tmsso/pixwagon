import { describe, expect, it } from 'vitest';
import {
  decodeClientMessage,
  encode,
  isIssuableRoomCode,
  MAX_PLAYERS,
  ROOM_CODE_ALPHABET,
  playerPresenceSchema,
  PROTOCOL_VERSION,
  rollSchema,
  roomCodeSchema,
  roomSnapshotSchema,
  serverErrorCodeSchema,
  serverMessageSchema,
} from './index.js';

describe('decodeClientMessage', () => {
  it('accepts a well-formed join', () => {
    const result = decodeClientMessage(
      JSON.stringify({ type: 'join', protocolVersion: PROTOCOL_VERSION, name: 'Alex' }),
    );
    expect(result).toEqual({
      ok: true,
      message: { type: 'join', protocolVersion: PROTOCOL_VERSION, name: 'Alex' },
    });
  });

  it('accepts a join with a rejoinToken, for a reconnect reclaiming its identity', () => {
    const result = decodeClientMessage(
      JSON.stringify({
        type: 'join',
        protocolVersion: PROTOCOL_VERSION,
        name: 'Alex',
        rejoinToken: 'a-token',
      }),
    );
    expect(result).toEqual({
      ok: true,
      message: {
        type: 'join',
        protocolVersion: PROTOCOL_VERSION,
        name: 'Alex',
        rejoinToken: 'a-token',
      },
    });
  });

  it('accepts a binary frame', () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ type: 'ping', t: 1 }));
    expect(decodeClientMessage(bytes.buffer as ArrayBuffer).ok).toBe(true);
  });

  // The referee must survive anything a client sends it, including garbage.
  it.each([
    ['not JSON at all', 'not valid JSON'],
    ['{"type":"nope"}', undefined],
    ['{"type":"fill"}', undefined],
    ['{"type":"join","protocolVersion":1}', undefined],
    ['null', undefined],
    ['[]', undefined],
  ])('rejects %s without throwing', (raw, expectedError) => {
    const result = decodeClientMessage(raw);
    expect(result.ok).toBe(false);
    if (!result.ok && expectedError) expect(result.error).toBe(expectedError);
  });

  const piecePlacement = (x: number, y: number) => ({
    pieceId: 'domino',
    orientation: { rotation: 0, mirrored: false },
    origin: { x, y },
  });

  it('accepts a well-formed pair fill', () => {
    const result = decodeClientMessage(
      JSON.stringify({
        type: 'fill',
        round: 0,
        choice: { kind: 'pair', placements: [piecePlacement(0, 0), piecePlacement(2, 0)] },
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('accepts a well-formed compound fallback fill', () => {
    const result = decodeClientMessage(
      JSON.stringify({
        type: 'fill',
        round: 0,
        choice: {
          kind: 'fallback',
          blobs: [
            [{ x: 0, y: 0 }],
            [
              { x: 3, y: 3 },
              { x: 4, y: 3 },
            ],
          ],
        },
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('rejects a pair fill with only one placement (atomic — both or neither)', () => {
    const result = decodeClientMessage(
      JSON.stringify({
        type: 'fill',
        round: 0,
        choice: { kind: 'pair', placements: [piecePlacement(0, 0)] },
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects a fallback fill with more than 2 blobs', () => {
    const result = decodeClientMessage(
      JSON.stringify({
        type: 'fill',
        round: 0,
        choice: { kind: 'fallback', blobs: [[{ x: 0, y: 0 }], [{ x: 1, y: 1 }], [{ x: 2, y: 2 }]] },
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects an oversized fallback blob rather than letting it reach the board', () => {
    const cells = Array.from({ length: 64 }, (_, i) => ({ x: i, y: 0 }));
    const result = decodeClientMessage(
      JSON.stringify({ type: 'fill', round: 0, choice: { kind: 'fallback', blobs: [cells] } }),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects negative cell coordinates', () => {
    const result = decodeClientMessage(
      JSON.stringify({
        type: 'fill',
        round: 0,
        choice: { kind: 'fallback', blobs: [[{ x: -1, y: 0 }]] },
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects an unknown move-choice kind', () => {
    const result = decodeClientMessage(
      JSON.stringify({ type: 'fill', round: 0, choice: { kind: 'jackpot' } }),
    );
    expect(result.ok).toBe(false);
  });

  it('trims and bounds display names', () => {
    const long = 'x'.repeat(64);
    expect(
      decodeClientMessage(JSON.stringify({ type: 'join', protocolVersion: 1, name: long })).ok,
    ).toBe(false);
  });
});

describe('roomCodeSchema', () => {
  it('accepts uppercase alphanumeric codes', () => {
    expect(roomCodeSchema.safeParse('PIXW').success).toBe(true);
    expect(roomCodeSchema.safeParse('7Q2M9XZ1').success).toBe(true);
  });

  it('rejects lowercase, punctuation and wrong lengths', () => {
    for (const bad of ['pixw', 'PIX', 'PIXWAGON9', 'PIX-W']) {
      expect(roomCodeSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe('isIssuableRoomCode', () => {
  it('accepts four characters from the issued alphabet', () => {
    // Not the design's sample "PIXW": it has an I, which is never issued.
    expect(isIssuableRoomCode('TRAM')).toBe(true);
    expect(isIssuableRoomCode('Z29K')).toBe(true);
  });

  it('rejects the look-alike characters, lowercase and wrong lengths', () => {
    for (const bad of ['PIX0', 'PIXO', 'PIX1', 'PIXI', 'pixw', 'PIX', 'PIXWA']) {
      expect(isIssuableRoomCode(bad)).toBe(false);
    }
  });

  it('issues only codes the looser wire schema also accepts', () => {
    expect(roomCodeSchema.safeParse(ROOM_CODE_ALPHABET.slice(0, 4)).success).toBe(true);
    expect(ROOM_CODE_ALPHABET).not.toMatch(/[IO01]/);
  });
});

describe('encode', () => {
  it('round-trips through decode', () => {
    const message = { type: 'ping', t: 42 } as const;
    const result = decodeClientMessage(encode(message));
    expect(result).toEqual({ ok: true, message });
  });
});

describe('room state shapes (Phase 4)', () => {
  it('MAX_PLAYERS is the seat count both sides read', () => {
    expect(MAX_PLAYERS).toBe(6);
  });

  const roll = {
    round: 0,
    seed: 'room-abc',
    pair: ['domino', 'tromino-l'],
    fallback: '1+2',
  };

  it('accepts a well-formed roll and rejects an unknown fallback face', () => {
    expect(rollSchema.safeParse(roll).success).toBe(true);
    expect(rollSchema.safeParse({ ...roll, fallback: '4' }).success).toBe(false);
    expect(rollSchema.safeParse({ ...roll, pair: ['only-one'] }).success).toBe(false);
  });

  const player = { id: 'p1', name: 'Alex', seatIndex: 0, isHost: true };

  it('accepts a player presence entry and bounds the seat index', () => {
    expect(playerPresenceSchema.safeParse(player).success).toBe(true);
    expect(playerPresenceSchema.safeParse({ ...player, seatIndex: MAX_PLAYERS }).success).toBe(
      false,
    );
    expect(playerPresenceSchema.safeParse({ ...player, seatIndex: -1 }).success).toBe(false);
  });

  it('accepts a room snapshot with a null roll before the host starts', () => {
    const snapshot = {
      code: 'PIXW',
      mode: 'same-board',
      round: 0,
      currentRoll: null,
      hostId: 'p1',
      players: [player],
      status: 'lobby',
      pictureId: null,
      roundBudget: null,
      boards: {},
      acted: [],
    };
    expect(roomSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(roomSnapshotSchema.safeParse({ ...snapshot, currentRoll: roll }).success).toBe(true);
    expect(roomSnapshotSchema.safeParse({ ...snapshot, mode: 'battle-royale' }).success).toBe(
      false,
    );
  });

  it('types the state / presence / roll server messages', () => {
    const state = {
      type: 'state',
      state: {
        code: 'PIXW',
        mode: 'solo',
        round: 2,
        currentRoll: roll,
        hostId: null,
        players: [],
        status: 'lobby',
        pictureId: null,
        roundBudget: null,
        boards: {},
        acted: [],
      },
    };
    expect(serverMessageSchema.safeParse(state).success).toBe(true);
    expect(serverMessageSchema.safeParse({ type: 'roll', roll }).success).toBe(true);
    expect(serverMessageSchema.safeParse({ type: 'presence', players: [player] }).success).toBe(
      true,
    );
    // A bare `state` with no snapshot no longer passes — it's typed now.
    expect(serverMessageSchema.safeParse({ type: 'state', state: {} }).success).toBe(false);
  });

  it('carries a not-host error code for host-only request-roll', () => {
    expect(serverErrorCodeSchema.safeParse('not-host').success).toBe(true);
  });
});

describe('Phase 5 messages', () => {
  const roll = { round: 0, seed: 's', pair: ['domino', 'monomino'], fallback: '1' };
  const player = { id: 'p1', name: 'Alex', seatIndex: 0, isHost: true };
  const board = {
    size: { width: 2, height: 1 },
    packId: 'transportation',
    pictureId: 'tram',
    cells: ['fillable', 'filled'],
  };

  it('a playing snapshot carries boards, acted, picture and budget', () => {
    const snapshot = {
      code: 'TRAM',
      mode: 'same-board',
      round: 1,
      currentRoll: roll,
      hostId: 'p1',
      players: [player],
      status: 'playing',
      pictureId: 'tram',
      roundBudget: 22,
      boards: { p1: board },
      acted: ['p1'],
    };
    expect(roomSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(
      roomSnapshotSchema.safeParse({ ...snapshot, boards: { p1: { ...board, cells: ['wet'] } } })
        .success,
    ).toBe(false);
    expect(roomSnapshotSchema.safeParse({ ...snapshot, status: 'paused' }).success).toBe(false);
  });

  it('decodes a pass with its round', () => {
    expect(decodeClientMessage(JSON.stringify({ type: 'pass', round: 3 })).ok).toBe(true);
    expect(decodeClientMessage(JSON.stringify({ type: 'pass' })).ok).toBe(false);
  });

  it('types delta, fill-rejected (a MoveRejection, no cells) and round-result', () => {
    expect(
      serverMessageSchema.safeParse({
        type: 'delta',
        delta: { playerId: 'p1', round: 0, cells: [{ x: 1, y: 0 }] },
      }).success,
    ).toBe(true);
    expect(
      serverMessageSchema.safeParse({ type: 'delta', delta: { anything: true } }).success,
    ).toBe(false);
    expect(
      serverMessageSchema.safeParse({ type: 'fill-rejected', round: 0, reason: 'not-offered' })
        .success,
    ).toBe(true);
    expect(
      serverMessageSchema.safeParse({ type: 'fill-rejected', round: 0, reason: 'nope' }).success,
    ).toBe(false);
    expect(
      serverMessageSchema.safeParse({
        type: 'round-result',
        result: {
          round: 0,
          scores: [{ playerId: 'p1', filled: 1, total: 2, completion: 0.5, points: 0 }],
          complete: false,
        },
        sessionEnded: false,
      }).success,
    ).toBe(true);
  });

  it('carries the Phase 5 error codes', () => {
    for (const code of ['already-acted', 'game-in-progress', 'not-playing']) {
      expect(serverErrorCodeSchema.safeParse(code).success).toBe(true);
    }
  });
});
