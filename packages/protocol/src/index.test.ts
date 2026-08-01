import { describe, expect, it } from 'vitest';
import { decodeClientMessage, encode, PROTOCOL_VERSION, roomCodeSchema } from './index.js';

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

describe('encode', () => {
  it('round-trips through decode', () => {
    const message = { type: 'ping', t: 42 } as const;
    const result = decodeClientMessage(encode(message));
    expect(result).toEqual({ ok: true, message });
  });
});
