import { create } from 'zustand';
import { applyMove, createBoard, isComplete, issueRoll } from '@pixwagon/game-core';
import type { Board, CellRef, Move, MoveRejection, Roll, Seed } from '@pixwagon/game-core';
import {
  candidateCells,
  clearActive as clearActivePending,
  isPendingComplete,
  mirrorActivePiece,
  pendingCellCount,
  placeActiveOrigin as placeActivePendingOrigin,
  type PendingChoice,
  rotateActivePiece,
  setActive as setActivePending,
  startFallback,
  startPair,
  toggleBlobCell as toggleBlobPendingCell,
  toMoveChoice,
} from './placement.ts';

/**
 * Client state store — decided 2026-08-15 (ROADMAP.md Phase 2): zustand over a
 * bare reducer, mainly because Phase 4/5's WebSocket handler will need to push
 * state updates from outside the React tree, and `getState()`/`setState()`
 * outside a component is a better fit for that than threading a reducer's
 * `dispatch` through context.
 *
 * This store is solo-only. Same-board/own-board multiplayer (Phase 5/6) will
 * need a `RoomState`-shaped store fed by the server, not a reuse of this one —
 * a solo session has no referee to disagree with.
 */

export interface SoloSessionConfig {
  roomSeed: Seed;
  packId: string;
  pictureId: string;
}

export type SoloStatus = 'playing' | 'complete';

/** No accounts in v1 (CLAUDE.md §1) — solo has exactly one seat, so a fixed
 *  id is enough; a room-issued id is Phase 4/5's job. */
export const SOLO_PLAYER_ID = 'solo';

export interface SoloGameState {
  packId: string;
  pictureId: string;
  roomSeed: Seed;
  /** 0-indexed, matching `issueRoll`/`Move.round`'s convention (`docs/contracts/rng.md`
   *  — "round 7", not "round 8", is the late-joiner example). `GameScreen`
   *  displays `round + 1` to the player; nothing internal should. */
  round: number;
  board: Board;
  roll: Roll;
  status: SoloStatus;
  /** The choice being composed this round, or `null` before the player picks
   *  pair vs. fallback. */
  pending: PendingChoice | null;
  /** Set when `applyMove` rejects a submitted choice — cleared on the next
   *  action. Solo validates client-side before enabling commit, so this
   *  should be rare, but it's the same rejection path Phase 5's real referee
   *  will use, exercised here without a server to produce it. */
  lastRejection: MoveRejection | null;

  /** (Re)starts the session on a fresh picture and/or seed. */
  start: (config: SoloSessionConfig) => void;
  /** Begins composing a pair or fallback choice for the current round. */
  choose: (kind: 'pair' | 'fallback') => void;
  setActive: (index: number) => void;
  rotateActive: () => void;
  mirrorActive: () => void;
  placeActiveOrigin: (cell: CellRef) => void;
  toggleBlobCell: (cell: CellRef) => void;
  /** Undo before commit (ROADMAP.md Phase 2) — clears the active piece's
   *  placement or the active blob's cells, not the whole pending choice. */
  clearActive: () => void;
  /** Abandons the whole pending choice, back to "nothing picked yet". */
  cancelChoice: () => void;
  /** Submits the pending choice through `applyMove` — the same function the
   *  future Durable Object referee runs (CLAUDE.md §4A/§4C). Advances the
   *  round, or ends the session if the picture is now complete. */
  commit: () => void;
  /** No legal move this round — advances without filling. */
  passRound: () => void;
}

const DEFAULT_CONFIG: SoloSessionConfig = {
  // A fresh id per page load, not a fixed constant: unlike the daily puzzle
  // (Phase 7), an ordinary solo game shouldn't replay identically on reload.
  // `?seed=` overrides this — see docs/contracts/rng.md and the Phase 1
  // achievability test's `achievability-0` witness, which is what a live
  // verification pass should pass in to get a reliably completable board.
  roomSeed: `solo-${crypto.randomUUID()}`,
  packId: 'transportation',
  pictureId: 'tram',
};

function sessionFromConfig(config: SoloSessionConfig) {
  return {
    packId: config.packId,
    pictureId: config.pictureId,
    roomSeed: config.roomSeed,
    round: 0,
    board: createBoard(config.packId, config.pictureId),
    roll: issueRoll(config.roomSeed, 0),
    status: 'playing' as SoloStatus,
    pending: null,
    lastRejection: null,
  };
}

/** Reads `?seed=` from the current URL, if any — see `DEFAULT_CONFIG`'s note. */
export function initialSoloConfig(search: string): SoloSessionConfig {
  const seed = new URLSearchParams(search).get('seed');
  return seed ? { ...DEFAULT_CONFIG, roomSeed: seed } : DEFAULT_CONFIG;
}

function updatePending(
  pending: PendingChoice | null,
  fn: (choice: PendingChoice) => PendingChoice,
): PendingChoice | null {
  return pending ? fn(pending) : pending;
}

export const useSoloGameStore = create<SoloGameState>((set, get) => ({
  ...sessionFromConfig(
    // Module-scope `window` access would break under `renderToStaticMarkup`
    // (scripts/check-screens.tsx runs this store in Node); guard it so the
    // default config still wins server-side.
    typeof window === 'undefined' ? DEFAULT_CONFIG : initialSoloConfig(window.location.search),
  ),

  start: (config) => set(sessionFromConfig(config)),

  choose: (kind) => {
    const { roll } = get();
    set({ pending: kind === 'pair' ? startPair(roll) : startFallback(roll), lastRejection: null });
  },

  setActive: (index) =>
    set((state) => ({ pending: updatePending(state.pending, (c) => setActivePending(c, index)) })),
  rotateActive: () =>
    set((state) => ({ pending: updatePending(state.pending, rotateActivePiece) })),
  mirrorActive: () =>
    set((state) => ({ pending: updatePending(state.pending, mirrorActivePiece) })),
  placeActiveOrigin: (cell) =>
    set((state) => ({
      pending: updatePending(state.pending, (c) => placeActivePendingOrigin(c, cell)),
    })),
  toggleBlobCell: (cell) =>
    set((state) => ({
      pending: updatePending(state.pending, (c) => toggleBlobPendingCell(c, cell)),
    })),
  clearActive: () =>
    set((state) => ({ pending: updatePending(state.pending, clearActivePending) })),
  cancelChoice: () => set({ pending: null, lastRejection: null }),

  commit: () => {
    const state = get();
    if (!state.pending || !isPendingComplete(state.pending)) return;

    const move: Move = {
      playerId: SOLO_PLAYER_ID,
      round: state.round,
      choice: toMoveChoice(state.pending),
    };
    const result = applyMove(state.board, state.roll, move);
    if (!result.ok) {
      set({ lastRejection: result.reason });
      return;
    }

    if (isComplete(result.board)) {
      set({ board: result.board, pending: null, lastRejection: null, status: 'complete' });
      return;
    }

    const round = state.round + 1;
    set({
      board: result.board,
      round,
      roll: issueRoll(state.roomSeed, round),
      pending: null,
      lastRejection: null,
    });
  },

  passRound: () => {
    const state = get();
    const round = state.round + 1;
    set({ round, roll: issueRoll(state.roomSeed, round), pending: null, lastRejection: null });
  },
}));

export { candidateCells, isPendingComplete, pendingCellCount };
