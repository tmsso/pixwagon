import { create } from 'zustand';
import { createBoard, issueRoll } from '@pixwagon/game-core';
import type { Board, Roll, Seed } from '@pixwagon/game-core';

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

export interface SoloGameState {
  packId: string;
  pictureId: string;
  roomSeed: Seed;
  round: number;
  board: Board;
  roll: Roll;
  /** (Re)starts the session on a fresh picture and/or seed. */
  start: (config: SoloSessionConfig) => void;
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
    round: 1,
    board: createBoard(config.packId, config.pictureId),
    roll: issueRoll(config.roomSeed, 1),
  };
}

/** Reads `?seed=` from the current URL, if any — see `DEFAULT_CONFIG`'s note. */
export function initialSoloConfig(search: string): SoloSessionConfig {
  const seed = new URLSearchParams(search).get('seed');
  return seed ? { ...DEFAULT_CONFIG, roomSeed: seed } : DEFAULT_CONFIG;
}

export const useSoloGameStore = create<SoloGameState>((set) => ({
  ...sessionFromConfig(
    // Module-scope `window` access would break under `renderToStaticMarkup`
    // (scripts/check-screens.tsx runs this store in Node); guard it so the
    // default config still wins server-side.
    typeof window === 'undefined' ? DEFAULT_CONFIG : initialSoloConfig(window.location.search),
  ),
  start: (config) => set(sessionFromConfig(config)),
}));
