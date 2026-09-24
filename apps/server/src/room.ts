import { decodeClientMessage, encode, PROTOCOL_VERSION } from '@pixwagon/protocol';
import type { ServerMessage } from '@pixwagon/protocol';
import type { Env } from './env.ts';
import { sendToAll } from './fanout.ts';
import {
  buildSnapshot,
  ensureSeed,
  findStaleConnection,
  initialRoomState,
  issueNextRoll,
  nextFreeSeat,
  presenceList,
  reclaimIdentity,
  registerIdentity,
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
  /**
   * Set once the join handshake completes; `undefined` for a provisional,
   * not-yet-joined socket. Lets a same-connection re-join (e.g. a display
   * name change with no fresh `rejoinToken` from the client) reuse the token
   * already registered for this identity instead of minting a redundant one.
   */
  rejoinToken?: string;
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

  /** The live, joined socket currently holding `playerId`, if any. Used to
   *  evict a stale connection (e.g. an old tab that never cleanly closed)
   *  when a rejoin reclaims its identity on a new socket. */
  #findLiveSocket(playerId: string, exclude?: WebSocket): WebSocket | null {
    return (
      this.#state.getWebSockets().find((socket) => {
        if (socket === exclude) return false;
        const a = this.#attachmentOf(socket);
        return a !== null && a.joined && a.playerId === playerId;
      }) ?? null
    );
  }

  /** Joined connections only, as the pure layer wants them. `exclude` is the
   *  socket whose close/error handler is running: Cloudflare says disconnected
   *  sockets are not returned by `getWebSockets()`, but does not promise the
   *  closing one is already gone while its handler runs — so drop it
   *  explicitly rather than let a leaver linger in presence and host election. */
  #seatedConns(exclude?: WebSocket): SeatedConn[] {
    return this.#state
      .getWebSockets()
      .filter((socket) => socket !== exclude)
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
          decoded.message.rejoinToken,
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
    ws: WebSocket,
    code: number,
    reason: string,
    _clean: boolean,
  ): Promise<void> {
    // Complete the close handshake. Under the Hibernation API the runtime does
    // not answer a client's Close frame for us here, and without the echo the
    // browser sits in CLOSING for ~10 s and then reports 1006 — observed live
    // 2026-09-24. 1005/1006/1015 are "no status" markers that must never be
    // sent on the wire, so those are answered with a plain 1000. Closing an
    // already-closed socket throws, which is fine to ignore.
    try {
      ws.close(code === 1005 || code === 1006 || code === 1015 ? 1000 : code, reason);
    } catch {
      // Already closed.
    }
    await this.#reconcile(ws);
  }

  async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    await this.#reconcile(ws);
  }

  // --- handlers ---------------------------------------------------------

  async #handleJoin(
    ws: WebSocket,
    attachment: Attachment,
    clientVersion: number,
    name: string,
    rejoinToken: string | undefined,
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

    const stored = await this.#loadRoom(attachment.code);

    let playerId = attachment.playerId;
    let seatIndex = attachment.seatIndex;
    let token = attachment.rejoinToken;
    let stale: WebSocket | null = null;

    // Full-room check and identity reclaim are here, not at accept: a seat is
    // only provisional until the handshake completes. A re-`join` on an
    // already-joined socket (e.g. a name change) skips both — its identity is
    // already settled.
    if (!attachment.joined) {
      const reclaimed = reclaimIdentity(stored, rejoinToken);
      if (reclaimed) {
        playerId = reclaimed.playerId;
        seatIndex = reclaimed.seatIndex;
        token = rejoinToken;
        // The old connection for this identity (a tab that never cleanly
        // closed) loses the seat to this new one rather than duplicating it.
        // `findStaleConnection` is the pure yes/no decision (unit-tested);
        // `#findLiveSocket` is the glue lookup of the actual socket to close.
        if (findStaleConnection(this.#seatedConns(ws), playerId)) {
          stale = this.#findLiveSocket(playerId, ws);
          stale?.close(4000, 'reconnected elsewhere');
        }
      } else {
        token = crypto.randomUUID();
      }

      // Exclude `stale` too: Cloudflare doesn't promise it's gone from
      // `getWebSockets()` just because `close()` was called (same reasoning
      // as `#reconcile`'s `exclude` param) — left uncounted here it would
      // make a reclaim look like room-full and double the seat in presence.
      const otherJoined = this.#seatedConns(stale ?? undefined).filter(
        (c) => c.id !== playerId,
      ).length;
      if (roomIsFull(otherJoined + 1)) {
        this.#send(ws, { type: 'error', code: 'room-full', message: 'this room is full' });
        ws.close(1013, 'room full');
        return;
      }
    }

    // `token` is always set by this point: the `!attachment.joined` branch
    // above assigns it in every path (reclaimed or fresh), and an
    // already-joined socket only reaches here because an earlier `join` call
    // already went through that branch and persisted one onto the
    // attachment. The `!`s below (and the one on `updated.rejoinToken`)
    // encode that invariant.
    const updated: Attachment = {
      ...attachment,
      playerId,
      seatIndex,
      name,
      joined: true,
      rejoinToken: token!,
    };
    ws.serializeAttachment(updated);

    // Read → modify → write with no non-storage await between: while a storage
    // op is outstanding the DO input gate holds the next message, so this stays
    // atomic even against a fast second join. Broadcasts happen after the put.
    const conns = this.#seatedConns(stale ?? undefined);
    const seeded = ensureSeed(stored, crypto.randomUUID());
    const withHost = resolveHost(seeded, conns);
    const next = registerIdentity(withHost, token!, { playerId, seatIndex, name });
    await this.#state.storage.put(ROOM_KEY, next);

    this.#send(ws, {
      type: 'welcome',
      protocolVersion: PROTOCOL_VERSION,
      playerId: updated.playerId,
      code: updated.code,
      rejoinToken: token!,
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
  async #reconcile(leaving?: WebSocket): Promise<void> {
    const conns = this.#seatedConns(leaving);
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
    sendToAll(this.#state.getWebSockets(), payload);
  }
}
