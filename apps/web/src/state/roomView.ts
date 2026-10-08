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
  points: number;
  filled: number;
  total: number;
  complete: boolean;
}

/**
 * The end-of-session ranking (Phase 5's Accept: "both see the same final
 * ranking"). Computed from the snapshot's boards with game-core's own
 * `scoreBoard`, never from a message only some clients received — so a
 * player who reconnects after the end ranks the room identically. Points
 * first (all-or-nothing, so a finished picture beats any partial one), then
 * filled squares. The full results screen is Phase 6.
 */
export function roomRanking(snapshot: RoomSnapshot): RankedPlayer[] {
  const rows = Object.entries(snapshot.boards).map(([playerId, wireBoard]) => {
    const board = wireBoard as Board;
    const score = scoreBoard(playerId, board);
    const player = snapshot.players.find((p) => p.id === playerId);
    return {
      playerId,
      name: player?.name ?? 'A player who left',
      seatIndex: player?.seatIndex ?? MAX_PLAYERS,
      points: score.points,
      filled: score.filled,
      total: score.total,
      complete: isComplete(board),
    };
  });
  rows.sort((a, b) => b.points - a.points || b.filled - a.filled || a.seatIndex - b.seatIndex);
  const ranked: RankedPlayer[] = [];
  for (const [index, row] of rows.entries()) {
    const prev = ranked[index - 1];
    // A tie shares the rank of the first player in it ("1, 1, 3").
    const tied = prev !== undefined && prev.points === row.points && prev.filled === row.filled;
    ranked.push({ ...row, rank: tied ? prev.rank : index + 1 });
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
