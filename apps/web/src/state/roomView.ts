import { isComplete, scoreBoard } from '@pixwagon/game-core';
import type { Board } from '@pixwagon/game-core';
import { MAX_PLAYERS, SKIP_WAITING_AFTER_MS } from '@pixwagon/protocol';
import type { RoomSnapshot } from '@pixwagon/protocol';
import type { RoomConnectionState, RoomPlayerIdentity } from './roomGame.ts';

/**
 * Pure view decisions for the room screens (ROADMAP.md Phase 4 item 4), kept
 * out of the components for the same reason `offerView.ts` is: testable
 * without rendering anything.
 */

/** Which room surface to show. `waiting` is the lobby-with-a-code (pass 02
 *  `02c`–`02e`); `playing` is the networked game (`12a`–`12c`); `ended` is
 *  the end-of-session ranking. Keyed on the server's `status` (Phase 5), not
 *  on whether a roll exists: a room stored before Phase 5 loads as `lobby`
 *  *with* a roll present, and must show the waiting room. */
export type RoomPhase = 'joining' | 'waiting' | 'playing' | 'ended';

export function roomPhase(snapshot: RoomSnapshot | null): RoomPhase {
  if (!snapshot) return 'joining';
  if (snapshot.status === 'ended') return 'ended';
  return snapshot.status === 'playing' && snapshot.currentRoll ? 'playing' : 'waiting';
}

/** Connected players the round is still waiting on — the client mirror of
 *  the server's `awaitingPlayers` (a complete board is never waited on). */
export function waitingOn(snapshot: RoomSnapshot): string[] {
  return snapshot.players
    .filter((p) => p.connected)
    .filter((p) => {
      const board = snapshot.boards[p.id] as Board | undefined;
      return board !== undefined && !isComplete(board) && !snapshot.acted.includes(p.id);
    })
    .map((p) => p.id);
}

/** "Waiting for Kim and Sam" — names in seat order, the viewer excluded. */
export function waitingLine(snapshot: RoomSnapshot, meId: string | null): string | null {
  const names = waitingOn(snapshot)
    .filter((id) => id !== meId)
    .map((id) => snapshot.players.find((p) => p.id === id)?.name ?? 'someone');
  if (names.length === 0) return null;
  const list =
    names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
  return `Waiting for ${list}`;
}

/** Whether the host's "Skip waiting players" button shows (owner decision
 *  2026-10-08): host only, someone other than the host still owed an action,
 *  and the round seen for at least `SKIP_WAITING_AFTER_MS`. */
export function canSkipWaiting(
  snapshot: RoomSnapshot,
  me: RoomPlayerIdentity | null,
  roundSeenAt: number | null,
  now: number,
): boolean {
  if (!me?.isHost || roundSeenAt === null || snapshot.status !== 'playing') return false;
  if (!waitingOn(snapshot).some((id) => id !== me.playerId)) return false;
  return now - roundSeenAt >= SKIP_WAITING_AFTER_MS;
}

export interface RankedPlayer {
  playerId: string;
  name: string;
  seatIndex: number;
  /** 1-based; tied players share a rank. */
  rank: number;
  /** Shares its rank with another player (pass 02 `13b`). */
  tied: boolean;
  /** Not connected at the end, or no longer in the room at all (`13c`).
   *  Still ranked: their squares count (pass 02 Annotation 19). */
  leftMidGame: boolean;
  /** Completed pictures across the session — what ranks first. */
  completedPictures: number;
  points: number;
  /** Squares filled across every picture — the tiebreak. */
  filled: number;
  total: number;
  /** One entry per picture of the session, oldest first, for `BoardCompare`.
   *  `null` for a picture played before this player joined. */
  boards: (Board | null)[];
}

/**
 * The end-of-session ranking (Phase 5's Accept: "both see the same final
 * ranking"; Phase 6 results, pass 02 `13a`–`13c`). Computed from the
 * snapshot alone — every finished picture's boards (`history`) plus the last
 * one's — with game-core's own `scoreBoard`, never from a message only some
 * clients received, so a player who reconnects after the end ranks the room
 * identically. Completed pictures first (scoring is all-or-nothing), then
 * filled squares across the session, then seat for a stable order.
 */
export function roomRanking(snapshot: RoomSnapshot): RankedPlayer[] {
  const stages = [...snapshot.history, snapshot.boards] as Record<string, Board>[];
  const ids = new Set(stages.flatMap((stage) => Object.keys(stage)));
  const rows = [...ids].map((playerId) => {
    const boards = stages.map((stage) => stage[playerId] ?? null);
    const scores = boards.flatMap((board) => (board ? [scoreBoard(playerId, board)] : []));
    const player = snapshot.players.find((p) => p.id === playerId);
    return {
      playerId,
      name: player?.name ?? 'A player who left',
      seatIndex: player?.seatIndex ?? MAX_PLAYERS,
      leftMidGame: !player?.connected,
      completedPictures: boards.filter((board) => board !== null && isComplete(board)).length,
      points: scores.reduce((sum, score) => sum + score.points, 0),
      filled: scores.reduce((sum, score) => sum + score.filled, 0),
      total: scores.reduce((sum, score) => sum + score.total, 0),
      boards,
    };
  });
  rows.sort(
    (a, b) =>
      b.completedPictures - a.completedPictures || b.filled - a.filled || a.seatIndex - b.seatIndex,
  );
  const sameScore = (a: (typeof rows)[number], b: (typeof rows)[number]) =>
    a.completedPictures === b.completedPictures && a.filled === b.filled;
  const ranked: RankedPlayer[] = [];
  for (const [index, row] of rows.entries()) {
    const prev = ranked[index - 1];
    const next = rows[index + 1];
    // A tie shares the rank of the first player in it ("1, 1, 3").
    const tiedWithPrev = prev !== undefined && sameScore(prev, row);
    ranked.push({
      ...row,
      rank: tiedWithPrev ? prev.rank : index + 1,
      tied: tiedWithPrev || (next !== undefined && sameScore(row, next)),
    });
  }
  return ranked;
}

/** Two players minimum (pass 02 `02c`, "Needs one more player") — a room of
 *  one is solo with extra steps. Returns why the host can't start yet, or
 *  `null` when they can. Non-hosts always get a reason. */
export function startBlockedReason(
  snapshot: RoomSnapshot,
  me: RoomPlayerIdentity | null,
): string | null {
  if (!me?.isHost) return 'Only the host can start';
  if (snapshot.players.length < 2) return 'Needs one more player';
  return null;
}

/** The waiting room's one line of status under the player list. */
export function waitingStatus(snapshot: RoomSnapshot): string | null {
  const count = snapshot.players.length;
  if (count >= MAX_PLAYERS) return 'Room is full — six is the most we can tell apart on a board.';
  if (count <= 1) return 'Waiting for someone to join.';
  return null;
}

/** The store's four connection states onto `HudFrame`'s pill. `idle` inside a
 *  room means the connection ended and is not being retried. */
export function connectionPill(
  connection: RoomConnectionState,
): 'online' | 'connecting' | 'reconnecting' | 'offline' {
  return connection === 'idle' ? 'offline' : connection;
}
