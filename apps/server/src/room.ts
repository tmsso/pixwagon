import { decodeClientMessage, encode, PROTOCOL_VERSION } from '@pixwagon/protocol';
import type { ServerMessage } from '@pixwagon/protocol';
import { MAX_SEATS, type Env } from './env.ts';

interface Attachment {
  playerId: string;
  name: string;
  colorIndex: number;
  /**
   * The room code this connection joined through. Carried per-connection rather
   * than in an instance field because hibernation may evict the instance while
   * sockets stay open — anything that must survive that lives in the attachment.
   */
  code: string;
}

/**
 * One Durable Object instance per room code — the architectural bet in §4C.
 *
 * Phase 0 scope: connections, presence and the protocol handshake. Rolls, fills
 * and scoring are Phase 4/5; what is proven here is that the primitive works —
 * a single addressable stateful object that terminates its own WebSockets.
 *
 * Written in the classic `constructor(state, env)` form rather than extending
 * the `DurableObject` base class. Both are supported; this one makes the two
 * things a DO actually depends on explicit, which suits a file that is mostly
 * going to be read as a reference for the next few phases.
 */
export class Room {
  #state: DurableObjectState;

  constructor(state: DurableObjectState, _env: Env) {
    this.#state = state;
  }

  /**
   * Lowest seat not currently occupied, derived from the live sockets.
   *
   * Deliberately *not* an incrementing instance field: hibernation may evict
   * this object while sockets stay open, and a counter would restart at 0 on
   * the next wake. The joiner would then be handed a seat someone is still
   * sitting in — same colour *and* same hatch as an existing player, which is
   * exactly the collision the colour-vision rules exist to prevent.
   */
  #nextFreeSeat(): number {
    const taken = new Set(
      this.#state
        .getWebSockets()
        .map((socket) => (socket.deserializeAttachment() as Attachment | null)?.colorIndex)
        .filter((index): index is number => index !== undefined),
    );
    for (let seat = 0; seat < MAX_SEATS; seat += 1) {
      if (!taken.has(seat)) return seat;
    }
    return taken.size % MAX_SEATS;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected a websocket upgrade', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    /**
     * `acceptWebSocket` (not `server.accept()`) opts into the **Hibernation
     * API**. The difference is not cosmetic: with hibernation the runtime may
     * evict this object from memory while sockets stay open, and stops billing
     * duration while it is idle. A room where nobody has rolled for a minute
     * would otherwise burn the free tier's 13,000 GB-s/day just sitting there.
     * The cost is that per-connection state must live in the attachment or in
     * storage, never in a plain instance field — the instance may not survive.
     */
    this.#state.acceptWebSocket(server);

    const attachment: Attachment = {
      playerId: crypto.randomUUID(),
      name: 'guest',
      colorIndex: this.#nextFreeSeat(),
      code: request.headers.get('X-Room-Code') ?? '',
    };
    server.serializeAttachment(attachment);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const decoded = decodeClientMessage(raw);
    if (!decoded.ok) {
      this.#send(ws, { type: 'error', code: 'bad-message', message: decoded.error });
      return;
    }

    const attachment = ws.deserializeAttachment() as Attachment | null;
    if (!attachment) {
      this.#send(ws, { type: 'error', code: 'internal', message: 'connection has no attachment' });
      return;
    }

    switch (decoded.message.type) {
      case 'join': {
        if (decoded.message.protocolVersion !== PROTOCOL_VERSION) {
          this.#send(ws, {
            type: 'error',
            code: 'protocol-version-mismatch',
            message: `server speaks protocol ${PROTOCOL_VERSION}, client sent ${decoded.message.protocolVersion}`,
          });
          ws.close(1002, 'protocol version mismatch');
          return;
        }
        const updated: Attachment = { ...attachment, name: decoded.message.name };
        ws.serializeAttachment(updated);
        this.#send(ws, {
          type: 'welcome',
          protocolVersion: PROTOCOL_VERSION,
          playerId: updated.playerId,
          code: updated.code,
        });
        this.#broadcastPresence();
        return;
      }

      case 'ping':
        this.#send(ws, { type: 'pong', t: decoded.message.t });
        return;

      case 'leave':
        ws.close(1000, 'left');
        this.#broadcastPresence();
        return;

      // Phase 4 issues real rolls; Phase 5 validates fills through game-core.
      case 'request-roll':
      case 'fill':
      case 'rematch':
        this.#send(ws, {
          type: 'error',
          code: 'internal',
          message: `"${decoded.message.type}" is not implemented yet — see Phase 4/5 in ROADMAP.md`,
        });
        return;
    }
  }

  async webSocketClose(_ws: WebSocket, _code: number, _reason: string, _clean: boolean) {
    this.#broadcastPresence();
  }

  async webSocketError(_ws: WebSocket, _error: unknown) {
    this.#broadcastPresence();
  }

  #send(ws: WebSocket, message: ServerMessage): void {
    ws.send(encode(message));
  }

  /** Presence is derived from the live sockets, so it cannot drift from reality. */
  #broadcastPresence(): void {
    const sockets = this.#state.getWebSockets();
    const players = sockets
      .map((socket) => socket.deserializeAttachment() as Attachment | null)
      .filter((attachment): attachment is Attachment => attachment !== null)
      .map(({ playerId, name, colorIndex }) => ({ id: playerId, name, colorIndex }));

    const payload = encode({ type: 'presence', players });
    for (const socket of sockets) socket.send(payload);
  }
}
