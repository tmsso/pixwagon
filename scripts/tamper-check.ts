/**
 * The Phase 5 item 4 tamper test, against a real running worker:
 *
 *   pnpm dev:server                     # in another terminal, or…
 *   pnpm tamper:check                   # defaults to http://localhost:8787
 *   pnpm tamper:check https://<preview-worker>.workers.dev
 *
 * Two raw WebSocket clients join a fresh room; the host starts the game. The
 * "tampered" client then sends fills a real client would never send — cells
 * the round's roll cannot cover, a piece that was not offered, cells off the
 * board. Each must come back `fill-rejected`, and the honest client must see
 * no `delta` for any of them. Finally the tamperer passes, so we also prove
 * the room is still healthy (the honest client sees that `passed`).
 *
 * The unit-level half is `apps/server/src/roomState.test.ts` ("tampered
 * fills"); this proves the Durable Object glue broadcasts only on acceptance.
 * Not in CI: it needs a running worker. It creates throwaway rooms, so it
 * refuses the production worker in code, not by convention.
 */

const PRODUCTION_HOSTS = ['pixwagon-app.tmsso.workers.dev'];

const origin = (process.argv[2] ?? 'http://localhost:8787').replace(/\/$/, '');
const host = new URL(origin).host;
if (PRODUCTION_HOSTS.includes(host)) {
  console.error(`Refusing to run against production (${host}). Use a local or preview worker.`);
  process.exit(2);
}
console.log(`tamper check against ${origin}`);

// Inlined rather than imported from `@pixwagon/protocol`: the workspace root
// doesn't depend on it. Must match PROTOCOL_VERSION.
const PROTOCOL_VERSION = 2;

type Message = { type: string; [key: string]: unknown };

interface Client {
  ws: WebSocket;
  messages: Message[];
  send: (message: object) => void;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function connect(code: string, name: string): Promise<Client> {
  const url = `${origin.replace(/^http/, 'ws')}/api/room/${code}/ws`;
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const client: Client = {
      ws,
      messages: [],
      send: (message) => ws.send(JSON.stringify(message)),
    };
    ws.onmessage = (event) => client.messages.push(JSON.parse(String(event.data)) as Message);
    ws.onerror = () => reject(new Error(`could not connect to ${url}`));
    ws.onopen = () => {
      client.send({ type: 'join', protocolVersion: PROTOCOL_VERSION, name });
      resolve(client);
    };
  });
}

/** Polls for a message matching `predicate`, ignoring the first `since`. */
async function waitFor(
  client: Client,
  predicate: (m: Message) => boolean,
  what: string,
  since = 0,
): Promise<Message> {
  for (let i = 0; i < 50; i += 1) {
    const found = client.messages.slice(since).find(predicate);
    if (found) return found;
    await sleep(100);
  }
  throw new Error(`timed out waiting for ${what}`);
}

let failures = 0;
function check(ok: boolean, label: string): void {
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (!ok) failures += 1;
}

const response = await fetch(`${origin}/api/room`, { method: 'POST' });
const { code } = (await response.json()) as { code: string };

const honest = await connect(code, 'Honest');
await waitFor(honest, (m) => m.type === 'welcome', 'honest welcome');
const tamperer = await connect(code, 'Tamperer');
const welcome = await waitFor(tamperer, (m) => m.type === 'welcome', 'tamperer welcome');
const tampererId = welcome.playerId as string;

// The first joiner is the host.
honest.send({ type: 'request-roll' });
const started = await waitFor(
  tamperer,
  (m) => m.type === 'state' && (m.state as { status: string }).status === 'playing',
  'the game to start',
);
const snapshot = started.state as {
  currentRoll: { round: number; pair: [string, string]; fallback: string };
  boards: Record<string, { size: { width: number }; cells: string[] }>;
};
const roll = snapshot.currentRoll;
const board = snapshot.boards[tampererId]!;
const fillable = board.cells.flatMap((cell, i) =>
  cell === 'fillable' ? [{ x: i % board.size.width, y: Math.floor(i / board.size.width) }] : [],
);
const offered = new Set(roll.pair);
const notOffered = ['monomino', 'domino', 'tromino-i', 'tromino-l'].find((id) => !offered.has(id))!;
const upright = { rotation: 0, mirrored: false };

const attempts: [string, object][] = [
  [
    `six fillable cells for a "${roll.fallback}" face`,
    { kind: 'fallback', blobs: [fillable.slice(0, 3), fillable.slice(3, 6)] },
  ],
  [
    `a "${notOffered}" the pair did not offer`,
    {
      kind: 'pair',
      placements: [
        { pieceId: notOffered, orientation: upright, origin: fillable[0] },
        { pieceId: roll.pair[1], orientation: upright, origin: fillable[10] },
      ],
    },
  ],
  ['cells off the board', { kind: 'fallback', blobs: [[{ x: 999, y: 999 }]] }],
];

for (const [label, choice] of attempts) {
  const before = tamperer.messages.length;
  tamperer.send({ type: 'fill', round: roll.round, choice });
  const reply = await waitFor(
    tamperer,
    (m) => ['fill-rejected', 'fill-accepted', 'error'].includes(m.type),
    `a ruling on ${label}`,
    before,
  );
  // `error: bad-message` also counts: the protocol's zod bounds can refuse a
  // shape before the referee sees it, which is the same outcome one layer up.
  check(
    reply.type === 'fill-rejected' || reply.type === 'error',
    `${label} → ${reply.type} (${String(reply.reason ?? reply.code)})`,
  );
}

await sleep(500);
check(
  !honest.messages.some((m) => m.type === 'delta'),
  'the honest client saw no delta for any tampered fill',
);

// The room is still healthy: a pass from the tamperer reaches the other side.
tamperer.send({ type: 'pass', round: roll.round });
await waitFor(
  honest,
  (m) => m.type === 'passed' && m.playerId === tampererId,
  "the tamperer's pass",
).then(
  () => check(true, 'the room still works afterwards (pass broadcast received)'),
  () => check(false, 'the room still works afterwards (pass broadcast received)'),
);

honest.ws.close();
tamperer.ws.close();
await sleep(200);
console.log(failures === 0 ? '\nTamper check passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
