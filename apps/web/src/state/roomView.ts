import { MAX_PLAYERS } from '@pixwagon/protocol';
import type { RoomSnapshot } from '@pixwagon/protocol';
import type { RoomConnectionState, RoomPlayerIdentity } from './roomGame.ts';

/**
 * Pure view decisions for the room screens (ROADMAP.md Phase 4 item 4), kept
 * out of the components for the same reason `offerView.ts` is: testable
 * without rendering anything.
 */

/** Which room surface to show. `waiting` is the lobby-with-a-code (pass 02
 *  `02c`–`02e`); `playing` is the networked game (`12a`–`12c`). There is no
 *  "game started" flag on the wire: the first issued roll *is* the start. */
export type RoomPhase = 'joining' | 'waiting' | 'playing';

export function roomPhase(snapshot: RoomSnapshot | null): RoomPhase {
  if (!snapshot) return 'joining';
  return snapshot.currentRoll ? 'playing' : 'waiting';
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
