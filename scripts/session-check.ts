/**
 * The Phase 6 session check, against a real running worker:
 *
 *   pnpm session:check                  # defaults to http://localhost:8787
 *   pnpm session:check https://<preview-worker>.workers.dev
 *
 * Two raw WebSocket clients join a fresh room. The host picks own-board and
 * the Garden pack (`configure`), the guest's attempt to configure is refused,
 * and so is an unknown pack. Then both pass every round, which spends each
 * picture's budget, so the room cycles through every picture (D8 lockstep)
 * until the session ends. Checked along the way: the players get different
 * pictures, each new picture arrives as a full `state` with fresh boards, and
 * the round counter keeps running across pictures.
 *
 * The rules themselves are unit-tested in `apps/server/src/roomState.test.ts`;
 * this proves the Durable Object glue sends what clients need. Not in CI: it
 * needs a running worker. It creates throwaway rooms, so it refuses the
 * production worker in code, not by convention.
 */

const PRODUCTION_HOSTS = ['pixwagon-app.tmsso.workers.dev'];

const origin = (process.argv[2] ?? 'http://localhost:8787').replace(/\/$/, '');
const host = new URL(origin).host;
if (PRODUCTION_HOSTS.includes(host)) {
  console.error(`Refusing to run against production (${host}). Use a local or preview worker.`);
  process.exit(2);
}
console.log(`session check against ${origin}`);

// Inlined rather than imported from `@pixwagon/protocol`, as in tamper-check:
// the workspace root doesn't depend on it. Must match PROTOCOL_VERSION.
const PROTOCOL_VERSION = 3;

type Message = { type: string; [key: string]: unknown };

interface Snapshot {
  status: string;
  mode: string;
  packId: string;
  round: number;
  stage: number;
  stageCount: number | null;
  stageStartRound: number;
  currentRoll: { round: number } | null;
  boards: Record<string, { packId: string; pictureId: string }>;
  history: unknown[];
}

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

const isState = (m: Message): m is Message & { state: Snapshot } => m.type === 'state';

const response = await fetch(`${origin}/api/room`, { method: 'POST' });
const { code } = (await response.json()) as { code: string };

const hostClient = await connect(code, 'Host');
const hostId = (await waitFor(hostClient, (m) => m.type === 'welcome', 'host welcome'))
  .playerId as string;
const guest = await connect(code, 'Guest');
const guestId = (await waitFor(guest, (m) => m.type === 'welcome', 'guest welcome'))
  .playerId as string;

// --- configure ---------------------------------------------------------------

let mark = guest.messages.length;
guest.send({ type: 'configure', packId: 'garden' });
const refused = await waitFor(guest, (m) => m.type === 'error', 'a refusal', mark);
check(refused.code === 'not-host', `a guest's configure is refused (${String(refused.code)})`);

mark = hostClient.messages.length;
hostClient.send({ type: 'configure', packId: 'no-such-pack' });
const badPack = await waitFor(hostClient, (m) => m.type === 'error', 'a refusal', mark);
check(badPack.code === 'bad-config', `an unknown pack is refused (${String(badPack.code)})`);

mark = guest.messages.length;
hostClient.send({ type: 'configure', mode: 'own-board', packId: 'garden' });
const configured = (await waitFor(guest, isState, 'the configured state', mark)) as {
  state: Snapshot;
};
check(
  configured.state.mode === 'own-board' && configured.state.packId === 'garden',
  'the guest sees the host’s choice: own-board, Garden',
);

// --- play through every picture by passing ----------------------------------

mark = guest.messages.length;
hostClient.send({ type: 'request-roll' });
const startedMsg = (await waitFor(
  guest,
  (m) => isState(m) && m.state.status === 'playing',
  'the game to start',
  mark,
)) as { state: Snapshot };
let snapshot = startedMsg.state;
check(
  snapshot.boards[hostId]!.pictureId !== snapshot.boards[guestId]!.pictureId,
  `own-board: different pictures (${snapshot.boards[hostId]!.pictureId} vs ${snapshot.boards[guestId]!.pictureId})`,
);
check(snapshot.boards[hostId]!.packId === 'garden', 'the game plays the chosen pack');
check(snapshot.stage === 0 && snapshot.stageCount === 3, 'stage 1 of 3');

const seenPictures: string[] = [snapshot.boards[hostId]!.pictureId];
let round = snapshot.currentRoll!.round;
let stageStates = 0;
let ended = false;

for (let guard = 0; guard < 400 && !ended; guard += 1) {
  mark = guest.messages.length;
  hostClient.send({ type: 'pass', round });
  guest.send({ type: 'pass', round });
  const result = await waitFor(guest, (m) => m.type === 'round-result', 'a round result', mark);
  if (result.sessionEnded) {
    ended = true;
    break;
  }
  const next = await waitFor(guest, (m) => m.type === 'roll' || isState(m), 'the next round', mark);
  if (isState(next)) {
    stageStates += 1;
    const previous = snapshot;
    snapshot = next.state;
    check(
      snapshot.stage === previous.stage + 1 && snapshot.history.length === snapshot.stage,
      `picture ${snapshot.stage + 1} arrives as a full state, previous boards in history`,
    );
    check(
      snapshot.currentRoll!.round === round + 1 && snapshot.stageStartRound === round + 1,
      `the round counter keeps running (round ${round} → ${snapshot.currentRoll!.round})`,
    );
    seenPictures.push(snapshot.boards[hostId]!.pictureId);
    round = snapshot.currentRoll!.round;
  } else {
    round = (next.roll as { round: number }).round;
  }
}

check(ended, 'the session ended');
check(stageStates === 2, `two picture changes for a three-picture pack (saw ${stageStates})`);
check(
  new Set(seenPictures).size === 3,
  `the host met every picture once (${seenPictures.join(', ')})`,
);

hostClient.ws.close();
guest.ws.close();
await sleep(200);
console.log(failures === 0 ? '\nSession check passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
