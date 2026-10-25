import { isComplete, scoreBoard } from '@pixwagon/game-core';
import type { Board } from '@pixwagon/game-core';
import { MAX_PLAYERS, SKIP_WAITING_AFTER_MS } from '@pixwagon/protocol';
import type { GameMode, RoomSnapshot } from '@pixwagon/protocol';
import type { PlayerStatus } from '../components/game/PlayerChip.tsx';
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

/** "Jo", "Jo and Ravi", "Jo, Kim and Ravi". */
export function joinNames(names: readonly string[]): string {
  return names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/** Names of the connected players the round still waits on, in seat order, the
 *  viewer excluded — the people "Waiting for …" and "Move on without …" name. */
export function waitingNames(snapshot: RoomSnapshot, meId: string | null): string[] {
  return waitingOn(snapshot)
    .filter((id) => id !== meId)
    .map((id) => snapshot.players.find((p) => p.id === id)?.name ?? 'someone');
}

/** "Waiting for Jo and Ravi — the next round starts by itself." Says what
 *  happens next so nobody hunts for a button (pass 03 note 7, Annotation 21). */
export function waitingLine(snapshot: RoomSnapshot, meId: string | null): string | null {
  const names = waitingNames(snapshot, meId);
  if (names.length === 0) return null;
  return `Waiting for ${joinNames(names)} — the next round starts by itself.`;
}

/** Where `playerId` is this round, for their chip (pass 03 note 6): away
 *  beats everything (their board is kept, the round doesn't wait on them),
 *  then a complete picture, then having acted, else still placing. */
export function playerStatus(snapshot: RoomSnapshot, playerId: string): PlayerStatus {
  const player = snapshot.players.find((p) => p.id === playerId);
  if (!player?.connected) return 'away';
  const board = snapshot.boards[playerId] as Board | undefined;
  if (board && isComplete(board)) return 'finished';
  return snapshot.acted.includes(playerId) ? 'done' : 'placing';
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

/** Where the room is in the session (Phase 6, D8): which picture of how
 *  many, and which round of that picture's budget. */
export interface PictureProgress {
  /** 1-based. */
  picture: number;
  pictures: number;
  /** 1-based, counted from the picture's first roll, not from round 0. */
  round: number;
  rounds: number | null;
  /** The first round of a picture after the first — the moment to say the
   *  room moved on. */
  isNewPicture: boolean;
}

export function pictureProgress(snapshot: RoomSnapshot): PictureProgress | null {
  if (snapshot.status === 'lobby' || !snapshot.currentRoll) return null;
  // `round` counts rolls issued, so the roll in play is round − stageStartRound.
  const round = Math.max(1, snapshot.round - snapshot.stageStartRound);
  return {
    picture: snapshot.stage + 1,
    pictures: snapshot.stageCount ?? 1,
    round,
    rounds: snapshot.roundBudget,
    isNewPicture: snapshot.stage > 0 && round === 1,
  };
}

/** How much of their current picture `playerId` has filled, 0–1, or `null`
 *  without a board — what an opponent's chip shows mid-game (D9). */
export function boardCompletion(snapshot: RoomSnapshot, playerId: string): number | null {
  const board = snapshot.boards[playerId] as Board | undefined;
  return board ? scoreBoard(playerId, board).completion : null;
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
  /** How many squares fewer than the player ranked just above, shown only when
   *  that gap is what put them below (same pictures finished, different
   *  squares); `null` otherwise (pass 03 note 11, "4 fewer squares"). */
  tieBreak: number | null;
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
    const decidedBySquares =
      prev !== undefined && !tiedWithPrev && prev.completedPictures === row.completedPictures;
    ranked.push({
      ...row,
      tieBreak: decidedBySquares ? prev.filled - row.filled : null,
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

/** The name guests are told decides things ("Alex starts the game…"). */
export function hostName(snapshot: RoomSnapshot): string {
  return snapshot.players.find((p) => p.isHost)?.name ?? 'The host';
}

/** The waiting room's one line of status under the player list. */
export function waitingStatus(snapshot: RoomSnapshot): string | null {
  const count = snapshot.players.length;
  if (count >= MAX_PLAYERS) return 'Room is full — six is the most we can tell apart on a board.';
  if (count <= 1) return 'Waiting for someone to join. Send them the link, or read out the code.';
  return null;
}

/** The store's four connection states onto `HudFrame`'s pill. `idle` inside a
 *  room means the connection ended and is not being retried. */
export function connectionPill(
  connection: RoomConnectionState,
): 'online' | 'connecting' | 'reconnecting' | 'offline' {
  return connection === 'idle' ? 'offline' : connection;
}

/** How one board of the session ended, for the strips that report it (pass 03
 *  notes 9 and 10): which picture, whether it was finished, what it scored and
 *  how many squares were left. Scoring is all-or-nothing, so an unfinished
 *  picture scores nothing however close it got. */
export interface PictureOutcome {
  packId: string;
  pictureId: string;
  complete: boolean;
  points: number;
  /** Squares still unfilled — "Nothing fitted those last six squares". */
  remaining: number;
}

export function boardOutcome(playerId: string, board: Board): PictureOutcome {
  const score = scoreBoard(playerId, board);
  return {
    packId: board.packId,
    pictureId: board.pictureId,
    complete: isComplete(board),
    points: score.points,
    remaining: score.total - score.filled,
  };
}

/** The picture this player played just before the one in play, or `null` for
 *  the first picture, or when they joined after it (no board of theirs in
 *  `history`). Read from the snapshot, so a reconnecting player sees it too. */
export function previousPicture(snapshot: RoomSnapshot, playerId: string): PictureOutcome | null {
  const board = snapshot.history.at(-1)?.[playerId] as Board | undefined;
  return board ? boardOutcome(playerId, board) : null;
}

export const NUMBER_WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
];

/** "that last square" / "those last six squares" — small numbers in words,
 *  because the line is read, not scanned. */
export function lastSquaresPhrase(remaining: number): string {
  if (remaining === 1) return 'that last square';
  return `those last ${NUMBER_WORDS[remaining] ?? remaining} squares`;
}

/** The results screen's headline and the line under it (pass 03 note 12,
 *  `13a`–`13d`): who won in words, never just a table. Ties name everyone
 *  they cover, the viewer first as "You". */
export function resultsHeadline(
  ranking: readonly RankedPlayer[],
  meId: string | null,
  mode: GameMode,
  pictures: number,
): { title: string; sub: string } {
  const top = ranking.filter((r) => r.rank === 1);
  const rule = 'Ranked by pictures finished, then squares.';
  if (top.length === 0) return { title: 'Game over', sub: rule };
  if (top.length > 1) {
    const names = [...top]
      .sort((a, b) => Number(b.playerId === meId) - Number(a.playerId === meId))
      .map((r) => (r.playerId === meId ? 'You' : r.name));
    return {
      title: 'It’s a tie',
      sub: `${joinNames(names)} finished the same pictures with the same number of squares.`,
    };
  }
  const winner = top[0]!;
  const title = winner.playerId === meId ? 'You win' : `${winner.name} wins`;
  if (pictures === 1) {
    return {
      title,
      sub: 'One picture this time. A finished picture scores 100; an unfinished one scores nothing.',
    };
  }
  if (mode === 'own-board') return { title, sub: `Same offers, different pictures. ${rule}` };
  if (winner.completedPictures === pictures) {
    const word = NUMBER_WORDS[pictures] ?? String(pictures);
    return { title, sub: `All ${word} pictures finished. ${rule}` };
  }
  return { title, sub: rule };
}
