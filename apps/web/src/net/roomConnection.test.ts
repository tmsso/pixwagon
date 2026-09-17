import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoomConnectionEvent, WebSocketLike } from './roomConnection.ts';
import { RoomConnection } from './roomConnection.ts';

/** A fake socket the test drives by hand: no real network, no timers of its
 *  own. `open()`/`receive()`/`drop()` simulate the three events RoomConnection
 *  listens for. */
class FakeSocket implements WebSocketLike {
  sent: string[] = [];
  closeCalls: Array<{ code: number | undefined; reason: string | undefined }> = [];
  onopen: (() => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;

  send(data: string): void {
    this.sent.push(data);
  }

  close(code?: number, reason?: string): void {
    this.closeCalls.push({ code, reason });
  }

  open(): void {
    this.onopen?.();
  }

  receive(data: string): void {
    this.onmessage?.({ data });
  }

  /** A non-deliberate drop, as a real network blip or a server-initiated
   *  close would produce — RoomConnection only ever calls `close()` itself
   *  for the deliberate case, so this is the only way `onclose` fires from
   *  the socket side. */
  drop(code = 1006, reason = ''): void {
    this.onclose?.({ code, reason });
  }
}

describe('RoomConnection', () => {
  let sockets: FakeSocket[];
  let events: RoomConnectionEvent[];
  let connection: RoomConnection;

  /** `sockets[n]` typed as possibly-undefined (noUncheckedIndexedAccess) is
   *  correct in general but noisy here, where the test itself guarantees the
   *  index exists — this is the one place that assumption is asserted. */
  function socketAt(index: number): FakeSocket {
    const found = sockets.at(index);
    if (!found) throw new Error(`expected a socket at index ${index}, got none`);
    return found;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    sockets = [];
    events = [];
    connection = new RoomConnection({
      url: 'wss://example.test/room',
      onEvent: (event) => events.push(event),
      createSocket: (url) => {
        const socket = new FakeSocket();
        sockets.push(socket);
        expect(url).toBe('wss://example.test/room');
        return socket;
      },
      // Pins jitter at its maximum so `delay === backoffMs` exactly, making
      // the schedule below deterministic instead of a range.
      jitter: () => 1,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('connects once at construction and reports status transitions', () => {
    expect(sockets).toHaveLength(1);
    expect(events).toEqual([{ type: 'status', status: 'connecting' }]);

    socketAt(0).open();
    expect(events).toContainEqual({ type: 'status', status: 'open' });
  });

  it('reconnects with capped exponential backoff across consecutive failures', () => {
    socketAt(0).open();
    events.length = 0;

    // Backoff only grows across *consecutive* failures — a successful open
    // resets it (covered separately below) — so this chains drops without
    // ever opening the reconnect attempts in between.
    // 500 -> 1000 -> 2000 -> 4000 -> 8000 -> 8000 (capped)
    const expectedDelays = [500, 1000, 2000, 4000, 8000, 8000];

    for (const [index, expectedDelay] of expectedDelays.entries()) {
      socketAt(-1).drop();
      expect(events).toContainEqual({ type: 'status', status: 'reconnecting' });
      events.length = 0;

      // Not yet at the deadline: no new socket.
      vi.advanceTimersByTime(expectedDelay - 1);
      expect(sockets).toHaveLength(index + 1);

      // At the deadline: a new socket is created, still unopened.
      vi.advanceTimersByTime(1);
      expect(sockets).toHaveLength(index + 2);
    }
  });

  it('resets backoff to the initial delay after a successful reconnect', () => {
    socketAt(0).open();
    socketAt(0).drop();
    vi.advanceTimersByTime(500);
    socketAt(-1).open();

    events.length = 0;
    socketAt(-1).drop();
    expect(events).toContainEqual({ type: 'status', status: 'reconnecting' });

    vi.advanceTimersByTime(499);
    expect(sockets).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(3);
  });

  it('surfaces a malformed inbound frame as a decode-error event, not a throw', () => {
    socketAt(0).open();
    events.length = 0;

    expect(() => socketAt(0).receive('{not json')).not.toThrow();
    expect(events).toEqual([{ type: 'decode-error', error: 'not valid JSON' }]);
  });

  it('passes a well-formed inbound frame through as a typed message event', () => {
    socketAt(0).open();
    events.length = 0;

    const welcome = { type: 'welcome', protocolVersion: 1, playerId: 'p1', code: 'ABCD' };
    socketAt(0).receive(JSON.stringify(welcome));

    expect(events).toEqual([{ type: 'message', message: welcome }]);
  });

  it('does not reconnect after a deliberate close', () => {
    socketAt(0).open();
    events.length = 0;

    connection.close();

    expect(socketAt(0).closeCalls).toEqual([{ code: 1000, reason: 'leave' }]);
    expect(events).toContainEqual({ type: 'status', status: 'closed' });

    // The socket's own onclose still fires in reality (close() is
    // asynchronous on a real WebSocket) — simulate that and confirm it
    // still doesn't schedule a reconnect.
    socketAt(0).drop();
    vi.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(1);
  });

  it('drops an outbound send while not open, without throwing', () => {
    // No open() call yet — still 'connecting'.
    expect(() => connection.send({ type: 'leave' })).not.toThrow();
    expect(socketAt(0).sent).toEqual([]);

    socketAt(0).open();
    connection.send({ type: 'leave' });
    expect(socketAt(0).sent).toEqual([JSON.stringify({ type: 'leave' })]);
  });
});
