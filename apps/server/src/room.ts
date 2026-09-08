import { decodeClientMessage, encode, PROTOCOL_VERSION } from '@pixwagon/protocol';
import type { ServerMessage } from '@pixwagon/protocol';
import type { Env } from './env.ts';
import {
  buildSnapshot,
  ensureSeed,
  initialRoomState,
  issueNextRoll,
  nextFreeSeat,
  presenceList,
  resolveHost,
  roomIsFull,
  type RoomState,
  type SeatedConn,
} from './roomState.ts';

interface Attachment {
  playerId: string;
  name: string;
  /** Seat 0..MAX_PLAYERS-1 — also the colour + hatch index (`playerColor`). */
  seatIndex: number;
  /** Set once the connection completes the `join` handshake. Sockets that have
   *  only been accepted hold a provisional seat but are not players yet. */
  joined: boolean;
  /**
   * The room code this connection joined through. Per-connection, not an
   * instance field: hibernation may evict the instance while sockets stay open,
   * and a Durable Object cannot recover the name it was addressed by — the
   * Worker passes it in `X-Room-Code`.
   */
  code: string;
}

const ROOM_KEY = 'room';

/**
 * One Durable Object instance per room code — the architectural bet in §4C.
 *
 * Phase 4 (this slice): the real protocol handshake, presence, host election,
 * and host-issued seeded rolls. Room-wide state (seed, round, mode, host) lives
 * in `state.storage`; per-connection state lives in the socket attachment;
 * nothing lives in an instance field, because the runtime may evict this object
 * between messages while its sockets stay open. Fills and scoring are Phase 5.
 * The client WebSocket layer and reconnect/resync are the deferred other half
 * of Phase 4.
 *
 * The room-state *decisions* are in `roomState.ts` (pure, unit-tested); this
 * class is the Cloudflare glue — sockets in, storage read/modify/write, fan-out.
 */
export class Room {
  #state: DurableObjectState;

  constructor(state: DurableObjectState, _env: Env) {
    this.#state = state;
  }

  // --- socket → data helpers ------------------------------------------------

  #attachmentOf(socket: WebSocket): Attachment | null {
    return socket.deserializeAttachment() as Attachment | null;
  }

  /** Every accepted socket's seat, joined or not — feeds `nextFreeSeat` so two
   *  simultaneous joiners never land on the same seat. */
  #takenSeats(): number[] {
    return this.#state
      .getWebSockets()
      .map((socket) => this.#attachmentOf(socket)?.seatIndex)
      .filter((seat): seat is number => seat !== undefined);
  }

  /** Joined connections only, as the pure layer wants them. */
  #seatedConns(): SeatedConn[] {
    return this.#state
      .getWebSockets()
      .map((socket) => this.#attachmentOf(socket))
      .filter((a): a is Attachment => a !== null && a.joined)
      .map(({ playerId, name, seatIndex }) => ({ id: playerId, name, seatIndex }));
  }

  async #loadRoom(code: string): Promise<RoomState> {
    return (await this.#state.storage.get<RoomState>(ROOM_KEY)) ?? initialRoomState(code);
  }

  // --- lifecycle ----------------------------------------------------------

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected a websocket upgrade', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    /**
     * `acceptWebSocket` (not `server.accept()`) opts into the Hibernation API:
     * the runtime may evict this object while sockets stay open and stops
     * billing wall-clock while it is idle. The price is that per-connection
     * state must be in the attachment (below), never a plain field.
     */
    this.#state.acceptWebSocket(server);

    const attachment: Attachment = {
      playerId: crypto.randomUUID(),
      name: 'guest',
      seatIndex: nextFreeSeat(this.#takenSeats()),
      joined: false,
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

    const attachment = this.#attachmentOf(ws);
    if (!attachment) {
      this.#send(ws, { type: 'error', code: 'internal', message: 'connection has no attachment' });
      return;
    }

    switch (decoded.message.type) {
      case 'join':
        return this.#handleJoin(
          ws,
          attachment,
          decoded.message.protocolVersion,
          decoded.message.name,
        );

      case 'request-roll':
        return this.#handleRequestRoll(ws, attachment);

      case 'ping':
        this.#send(ws, { type: 'pong', t: decoded.message.t });
        return;

      case 'leave':
        ws.close(1000, 'left');
        // webSocketClose fires and reconciles presence + host.
        return;

      // Phase 5 validates fills through game-core and scores rounds.
      case 'fill':
      case 'rematch':
        this.#send(ws, {
          type: 'error',
          code: 'internal',
          message: `"${decoded.message.type}" is not implemented yet — see Phase 5 in ROADMAP.md`,
        });
        return;
    }
  }

  async webSocketClose(
    _ws: WebSocket,
    _code: number,
    _reason: string,
    _clean: boolean,
  ): Promise<void> {
    await this.#reconcile();
  }

  async webSocketError(_ws: WebSocket, _error: unknown): Promise<void> {
    await this.#reconcile();
  }

  // --- handlers ---------------------------------------------------------

  async #handleJoin(
    ws: WebSocket,
    attachment: Attachment,
    clientVersion: number,
    name: string,
  ): Promise<void> {
    if (clientVersion !== PROTOCOL_VERSION) {
      this.#send(ws, {
        type: 'error',
        code: 'protocol-version-mismatch',
        message: `server speaks protocol ${PROTOCOL_VERSION}, client sent ${clientVersion}`,
      });
      ws.close(1002, 'protocol version mismatch');
      return;
    }

    // Full-room check is here, not at accept: a seat is only provisional until
    // the handshake completes. A re-`join` on an already-joined socket (e.g. a
    // name change) skips it.
    if (!attachment.joined) {
      const otherJoined = this.#seatedConns().filter((c) => c.id !== attachment.playerId).length;
      if (roomIsFull(otherJoined + 1)) {
        this.#send(ws, { type: 'error', code: 'room-full', message: 'this room is full' });
        ws.close(1013, 'room full');
        return;
      }
    }

    const updated: Attachment = { ...attachment, name, joined: true };
    ws.serializeAttachment(updated);

    // Read → modify → write with no non-storage await between: while a storage
    // op is outstanding the DO input gate holds the next message, so this stays
    // atomic even against a fast second join. Broadcasts happen after the put.
    const stored = await this.#loadRoom(updated.code);
    const conns = this.#seatedConns();
    const seeded = ensureSeed(stored, crypto.randomUUID());
    const next = resolveHost(seeded, conns);
    await this.#state.storage.put(ROOM_KEY, next);

    this.#send(ws, {
      type: 'welcome',
      protocolVersion: PROTOCOL_VERSION,
      playerId: updated.playerId,
      code: updated.code,
    });
    this.#send(ws, { type: 'state', state: buildSnapshot(next, conns) });
    this.#broadcast(encode({ type: 'presence', players: presenceList(next, conns) }));
  }

  async #handleRequestRoll(ws: WebSocket, attachment: Attachment): Promise<void> {
    if (!attachment.joined) {
      this.#send(ws, {
        type: 'error',
        code: 'not-joined',
        message: 'join before requesting a roll',
      });
      return;
    }

    const stored = await this.#state.storage.get<RoomState>(ROOM_KEY);
    if (!stored || stored.roomSeed === null) {
      this.#send(ws, { type: 'error', code: 'internal', message: 'room is not initialised' });
      return;
    }
    if (stored.hostId !== attachment.playerId) {
      this.#send(ws, {
        type: 'error',
        code: 'not-host',
        message: 'only the host can start the next round',
      });
      return;
    }

    // Same read → modify → write discipline as join.
    const { roll, state: next } = issueNextRoll(stored);
    await this.#state.storage.put(ROOM_KEY, next);
    this.#broadcast(encode({ type: 'roll', roll }));
  }

  /** Recompute presence and host after a disconnect, persist a host change,
   *  and tell everyone. Presence carries `isHost`, so a client learns a host
   *  handoff from this alone. */
  async #reconcile(): Promise<void> {
    const conns = this.#seatedConns();
    const stored = await this.#state.storage.get<RoomState>(ROOM_KEY);
    const next = stored ? resolveHost(stored, conns) : null;
    if (stored && next && next !== stored) {
      await this.#state.storage.put(ROOM_KEY, next);
    }
    const state = next ?? initialRoomState('');
    this.#broadcast(encode({ type: 'presence', players: presenceList(state, conns) }));
  }

  // --- fan-out ---------------------------------------------------------

  #send(ws: WebSocket, message: ServerMessage): void {
    ws.send(encode(message));
  }

  #broadcast(payload: string): void {
    for (const socket of this.#state.getWebSockets()) socket.send(payload);
  }
}
