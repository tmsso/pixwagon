import { describe, expect, it } from 'vitest';
import { decodeClientMessage, encode, PROTOCOL_VERSION, roomCodeSchema } from './index.js';

describe('decodeClientMessage', () => {
  it('accepts a well-formed join', () => {
    const result = decodeClientMessage(
      JSON.stringify({ type: 'join', protocolVersion: PROTOCOL_VERSION, name: 'Tamas' }),
    );
    expect(result).toEqual({
      ok: true,
      message: { type: 'join', protocolVersion: PROTOCOL_VERSION, name: 'Tamas' },
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

  it('rejects an oversized fill rather than letting it reach the board', () => {
    const cells = Array.from({ length: 64 }, (_, i) => ({ x: i, y: 0 }));
    const result = decodeClientMessage(
      JSON.stringify({ type: 'fill', round: 0, comboId: 'a', cells }),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects negative cell coordinates', () => {
    const result = decodeClientMessage(
      JSON.stringify({ type: 'fill', round: 0, comboId: 'a', cells: [{ x: -1, y: 0 }] }),
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
