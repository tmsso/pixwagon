/**
 * The Phase 6 play check, against a real running worker:
 *
 *   pnpm play:check https://<preview-worker>.workers.dev [own-board|same-board]
 *
 * Two greedy bots play a Garden session over raw WebSockets, placing real
 * pieces with game-core's own `legalCellsFor` / `applyMove` (the approach of
 * the Phase 1 achievability test), and log how each picture resolved. This
 * is what shows Phase 6's Accept clause "two players finish different
 * pictures from the same round-by-round offers" end to end, including the
 * room advancing because every board is complete (`[COMPLETION-TRIGGERED]`).
 * The room seed is server-random, and the greedy bot does not always finish
 * a picture, so a run that only shows budget advances is inconclusive, not
 * a failure. A rejected fill or a stuck round is a failure.
 *
 * Not in CI: it needs a running worker. It creates throwaway rooms, so it
 * refuses the production worker in code, not by convention.
 */
import {
  applyMove,
  FALLBACK_BLOB_SIZES,
  isComplete,
  legalCellsFor,
} from '../packages/game-core/src/index.ts';
import type { Board, CellRef, Move, Roll } from '../packages/game-core/src/index.ts';

const PRODUCTION_HOSTS = ['pixwagon-app.tmsso.workers.dev'];
const origin = (process.argv[2] ?? 'http://localhost:8787').replace(/\/$/, '');
if (PRODUCTION_HOSTS.includes(new URL(origin).host)) {
  console.error('Refusing to run against production. Use a local or preview worker.');
  process.exit(2);
}
const mode = process.argv[3] ?? 'own-board';
/** The slice of a room snapshot this script reads. */
interface Snap {
  stage: number;
  roundBudget: number;
  currentRoll: Roll;
  boards: Record<string, Board>;
}
interface Msg {
  type: string;
  playerId?: string;
  state?: Snap;
  roll?: Roll;
  sessionEnded?: boolean;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function findBlob(board: Board, size: number, avoid: Set<string>): CellRef[] | null {
  const W = board.size.width,
    H = board.size.height;
  const ok = (x: number, y: number) =>
    x >= 0 &&
    y >= 0 &&
    x < W &&
    y < H &&
    board.cells[y * W + x] === 'fillable' &&
    !avoid.has(`${x},${y}`);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!ok(x, y)) continue;
      const blob: CellRef[] = [{ x, y }];
      const seen = new Set([`${x},${y}`]);
      for (let i = 0; i < blob.length && blob.length < size; i++) {
        const c = blob[i]!;
        for (const [dx, dy] of [
          [1, 0],
          [0, 1],
          [-1, 0],
          [0, -1],
        ]) {
          const nx = c.x + dx!,
            ny = c.y + dy!;
          if (blob.length < size && ok(nx, ny) && !seen.has(`${nx},${ny}`)) {
            seen.add(`${nx},${ny}`);
            blob.push({ x: nx, y: ny });
          }
        }
      }
      if (blob.length === size) return blob;
    }
  return null;
}

function chooseMove(board: Board, roll: Roll, playerId: string): Move['choice'] | null {
  const [a, b] = roll.pair;
  let best: { choice: Move['choice']; gain: number } | null = null;
  const pa = legalCellsFor(board, a),
    pb = legalCellsFor(board, b);
  for (const p of pa) {
    for (const q of pb) {
      const choice: Move['choice'] = {
        kind: 'pair',
        placements: [
          { pieceId: a, orientation: p.orientation, origin: p.origin },
          { pieceId: b, orientation: q.orientation, origin: q.origin },
        ],
      };
      const r = applyMove(board, roll, { playerId, round: roll.round, choice });
      if (r.ok) {
        best = { choice, gain: 99 };
        break;
      }
    }
    if (best) break;
  }
  if (best) return best.choice;
  const avoid = new Set<string>();
  const blobs: CellRef[][] = [];
  for (const size of FALLBACK_BLOB_SIZES[roll.fallback]) {
    const blob = findBlob(board, size, avoid);
    if (!blob) return null;
    blob.forEach((c) => avoid.add(`${c.x},${c.y}`));
    blobs.push(blob);
  }
  const choice: Move['choice'] = { kind: 'fallback', blobs };
  return applyMove(board, roll, { playerId, round: roll.round, choice }).ok ? choice : null;
}

async function connect(code: string, name: string) {
  const ws = new WebSocket(`${origin.replace(/^http/, 'ws')}/api/room/${code}/ws`);
  const c = { ws, msgs: [] as Msg[], id: '', send: (m: object) => ws.send(JSON.stringify(m)) };
  ws.onmessage = (e) => c.msgs.push(JSON.parse(String(e.data)));
  await new Promise((r) => (ws.onopen = r));
  c.send({ type: 'join', protocolVersion: 3, name });
  for (let i = 0; i < 50 && !c.id; i++) {
    const w = c.msgs.find((m) => m.type === 'welcome');
    if (w) c.id = w.playerId;
    await sleep(100);
  }
  return c;
}

const { code } = (await (await fetch(`${origin}/api/room`, { method: 'POST' })).json()) as {
  code: string;
};
const A = await connect(code, 'BotA');
const B = await connect(code, 'BotB');
A.send({ type: 'configure', mode, packId: 'garden' });
await sleep(400);
A.send({ type: 'request-roll' });

// Each bot tracks its own board from state snapshots + its own fill-accepted.
let snap: Snap | undefined;
const boards: Record<string, Board> = {};
const lastState = () => [...B.msgs].reverse().find((m) => m.type === 'state')?.state;
for (let i = 0; i < 50 && !(snap = lastState())?.currentRoll; i++) await sleep(100);
let failed = false;
const log: string[] = [];
if (!snap) throw new Error('the game did not start');
let roll: Roll = snap.currentRoll;
for (const id of [A.id, B.id]) boards[id] = snap.boards[id];
log.push(
  `start stage0 A=${boards[A.id]!.pictureId} B=${boards[B.id]!.pictureId} budget=${snap.roundBudget}`,
);

for (let guard = 0; guard < 300; guard++) {
  const mark = B.msgs.length;
  for (const bot of [A, B]) {
    const board = boards[bot.id]!;
    if (isComplete(board)) continue; // a complete board is never waited on
    const choice = chooseMove(board, roll, bot.id);
    if (choice) {
      const r = applyMove(board, roll, { playerId: bot.id, round: roll.round, choice });
      if (r.ok) boards[bot.id] = r.board;
      bot.send({ type: 'fill', round: roll.round, choice });
    } else bot.send({ type: 'pass', round: roll.round });
  }
  let res: Msg | undefined;
  for (let i = 0; i < 80 && !(res = B.msgs.slice(mark).find((m) => m.type === 'round-result')); i++)
    await sleep(50);
  if (!res) {
    log.push(`stuck at round ${roll.round}`);
    failed = true;
    break;
  }
  const rejected = [...A.msgs, ...B.msgs].filter((m) => m.type === 'fill-rejected').length;
  if (rejected) {
    log.push(`REJECTED fills: ${rejected}`);
    failed = true;
    break;
  }
  if (res.sessionEnded) {
    log.push(
      `session ended at round ${roll.round}: A complete=${isComplete(boards[A.id]!)} B complete=${isComplete(boards[B.id]!)}`,
    );
    break;
  }
  let next: Msg | undefined;
  for (
    let i = 0;
    i < 80 && !(next = B.msgs.slice(mark).find((m) => m.type === 'roll' || m.type === 'state'));
    i++
  )
    await sleep(50);
  if (next!.type === 'state') {
    const prev = { a: isComplete(boards[A.id]!), b: isComplete(boards[B.id]!) };
    const s = next!.state;
    for (const id of [A.id, B.id]) boards[id] = s.boards[id];
    log.push(
      `advance at round ${roll.round}: completed A=${prev.a} B=${prev.b} → stage${s.stage} A=${boards[A.id]!.pictureId} B=${boards[B.id]!.pictureId}${prev.a && prev.b ? ' [COMPLETION-TRIGGERED]' : ' [budget/other]'}`,
    );
    roll = s.currentRoll;
  } else roll = next!.roll;
}
console.log(`room ${code} (${mode})`);
console.log(log.join('\n'));
A.ws.close();
B.ws.close();
await sleep(200);
process.exit(failed ? 1 : 0);
