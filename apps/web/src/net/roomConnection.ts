/**
 * The client WebSocket transport (ROADMAP.md Phase 4 client half, item 1).
 *
 * Deliberately dumb: this class owns one socket and its reconnect timer, and
 * nothing else. It does not know about `join`, rejoin tokens, or room state —
 * that belongs to `roomGame.ts` (item 3), which reacts to the events this
 * class emits. Splitting it out this way is what lets the reconnect/backoff
 * logic be unit-tested against a fake socket, with no React and no real
 * network.
 *
 * Reconnect: capped exponential backoff (0.5s -> 8s, jittered) on any close
 * that this class did not itself request via `close()`. Jitter avoids every
 * client in a room retrying in lockstep after a shared network blip.
 *
 * Trust boundary: inbound frames are JSON-parsed but not zod-validated here,
 * per docs/contracts/ws-protocol.md ("Direction and trust") — the server is
 * the authority, so re-validating truth the client cannot override buys
 * nothing. A frame that isn't even valid JSON still has to go somewhere,
 * though, so that case surfaces as its own `decode-error` event rather than
 * throwing out of a socket callback.
 */

import { encode } from '@pixwagon/protocol';
import type { ClientMessage, ServerMessage } from '@pixwagon/protocol';

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';

export type RoomConnectionEvent =
  | { type: 'status'; status: ConnectionStatus }
  | { type: 'message'; message: ServerMessage }
  | { type: 'decode-error'; error: string };

/**
 * The subset of the browser `WebSocket` API this module needs. Assignable
 * callback properties, not `addEventListener`, so a test fake can be a plain
 * object with no `EventTarget` machinery behind it.
 */
export interface WebSocketLike {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: (() => void) | null;
  onclose: ((event: { code: number; reason: string }) => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

export type WebSocketFactory = (url: string) => WebSocketLike;

const defaultFactory: WebSocketFactory = (url) => new WebSocket(url) as unknown as WebSocketLike;

const INITIAL_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 8000;

export interface RoomConnectionOptions {
  url: string;
  onEvent: (event: RoomConnectionEvent) => void;
  /** Test seam: inject a fake socket instead of a real one. */
  createSocket?: WebSocketFactory;
  /** Test seam: replaces `Math.random()` so backoff timing is deterministic. */
  jitter?: () => number;
}

export class RoomConnection {
  readonly #url: string;
  readonly #onEvent: (event: RoomConnectionEvent) => void;
  readonly #createSocket: WebSocketFactory;
  readonly #jitter: () => number;

  #socket: WebSocketLike | null = null;
  #isOpen = false;
  #deliberateClose = false;
  #backoffMs = INITIAL_BACKOFF_MS;
  #reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: RoomConnectionOptions) {
    this.#url = options.url;
    this.#onEvent = options.onEvent;
    this.#createSocket = options.createSocket ?? defaultFactory;
    this.#jitter = options.jitter ?? Math.random;
    this.#emitStatus('connecting');
    this.#connect();
  }

  /** Silently dropped if the socket isn't currently open — callers gate on
   *  the `status` events rather than this class queuing on their behalf.
   *  Queuing-across-reconnect is the rejoin layer's job (item 2), not
   *  transport's. */
  send(message: ClientMessage): void {
    if (!this.#socket || !this.#isOpen) return;
    this.#socket.send(encode(message));
  }

  /** A deliberate leave. No reconnect follows — this is the one close this
   *  class initiates itself, so it's the one case the reconnect loop must
   *  not treat as a drop. */
  close(): void {
    this.#deliberateClose = true;
    if (this.#reconnectTimer !== null) {
      clearTimeout(this.#reconnectTimer);
      this.#reconnectTimer = null;
    }
    this.#isOpen = false;
    this.#socket?.close(1000, 'leave');
    this.#socket = null;
    this.#emitStatus('closed');
  }

  #connect(): void {
    const socket = this.#createSocket(this.#url);
    this.#socket = socket;

    socket.onopen = () => {
      this.#isOpen = true;
      this.#backoffMs = INITIAL_BACKOFF_MS;
      this.#emitStatus('open');
    };

    socket.onmessage = (event) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        this.#onEvent({ type: 'decode-error', error: 'not valid JSON' });
        return;
      }
      this.#onEvent({ type: 'message', message: parsed as ServerMessage });
    };

    socket.onclose = () => {
      this.#isOpen = false;
      this.#socket = null;
      if (this.#deliberateClose) return;
      this.#scheduleReconnect();
    };

    // A real WebSocket always fires `close` after `error`, so the reconnect
    // is driven entirely from `onclose` — nothing to do here.
    socket.onerror = () => {};
  }

  #scheduleReconnect(): void {
    const delay = this.#backoffMs * (0.5 + this.#jitter() * 0.5);
    this.#backoffMs = Math.min(this.#backoffMs * 2, MAX_BACKOFF_MS);
    this.#emitStatus('reconnecting');
    this.#reconnectTimer = setTimeout(() => {
      this.#reconnectTimer = null;
      this.#connect();
    }, delay);
  }

  #emitStatus(status: ConnectionStatus): void {
    this.#onEvent({ type: 'status', status });
  }
}
