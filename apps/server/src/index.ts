import { PROTOCOL_VERSION, roomCodeSchema } from '@pixwagon/protocol';
import { generateRoomCode, type Env } from './env.ts';

export { Room } from './room.ts';

/**
 * The edge router (§4D). Deliberately thin — it resolves a room code to the
 * right Durable Object and gets out of the way. Anything stateful belongs in the
 * DO, not here; a Worker invocation has no memory between requests.
 *
 * Note that `room` and `worker` from the architecture doc live in one package.
 * That is not a simplification: a Durable Object cannot be deployed
 * independently of the Worker that binds it — they are a single deployable unit
 * by Cloudflare's design. They stay separate modules so the responsibilities
 * described in §4C/§4D remain separable in the code.
 */
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/health') {
      return json({ ok: true, protocolVersion: PROTOCOL_VERSION });
    }

    if (path === '/api/config') {
      return json({ protocolVersion: PROTOCOL_VERSION, maxPlayers: 6 });
    }

    // Create a room. The code is just a name for a Durable Object — no storage
    // is involved, which is why the early phases need no database at all (§4F).
    if (path === '/api/room' && request.method === 'POST') {
      return json({ code: generateRoomCode() }, 201);
    }

    // Join: upgrade the socket and hand it to the room's own object.
    const joinMatch = /^\/api\/room\/([^/]+)\/ws$/.exec(path);
    if (joinMatch) {
      const code = joinMatch[1]?.toUpperCase() ?? '';
      if (!roomCodeSchema.safeParse(code).success) {
        return json({ error: 'invalid room code' }, 400);
      }
      if (request.headers.get('Upgrade') !== 'websocket') {
        return json({ error: 'expected a websocket upgrade' }, 426);
      }

      // idFromName is what makes the room code addressable: the same code always
      // resolves to the same object, anywhere in the world, with no lookup table.
      const id = env.ROOM.idFromName(code);

      // The mapping is one-way — a Durable Object cannot recover the name it was
      // addressed by, only its opaque id. So the router has to tell it. Without
      // this the room would report a meaningless hex string as its own code.
      const forwarded = new Request(request);
      forwarded.headers.set('X-Room-Code', code);
      return env.ROOM.get(id).fetch(forwarded);
    }

    return json({ error: 'not found' }, 404);
  },
} satisfies ExportedHandler<Env>;
