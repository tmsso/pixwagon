/**
 * The shared vocabulary. Both the browser and the Durable Object speak this,
 * which is the whole point of game-core being a pure module (architecture.md §4A).
 *
 * Phase 1, 2026-08-01: rewritten for the pair+fallback mechanic
 * (docs/mechanics-correction.md) — the dice/combo shapes this file described
 * in Phase 0 (`Die`, `ComboOption`, `Roll.dice`/`Roll.combo`) are gone.
 */

import type { Orientation, PieceId } from './shapes.js';

/** Room codes are short, unambiguous and human-speakable over a voice call. */
export type RoomCode = string;

/** Opaque per-connection player identity. No accounts in v1 (§8). */
export type PlayerId = string;

export type Seed = string;

export interface Player {
  id: PlayerId;
  /** Display name only — v1 has no accounts. */
  name: string;
  /** Index into the pack palette's player-colour set. */
  colorIndex: number;
  connected: boolean;
}

export type GameMode = 'same-board' | 'own-board' | 'solo' | 'daily';

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

export interface GridSize {
  width: number;
  height: number;
}

export interface CellRef {
  x: number;
  y: number;
}

export type CellState =
  | 'blank' // not part of the target picture; never fillable
  | 'fillable' // part of the picture, not yet filled
  | 'filled' // filled by this player
  | 'locked'; // resolved and no longer changeable this round

export interface Board {
  size: GridSize;
  packId: string;
  pictureId: string;
  /** Row-major, length === size.width * size.height. */
  cells: readonly CellState[];
}

// ---------------------------------------------------------------------------
// Rolls and moves — pair + fallback (docs/mechanics-correction.md)
// ---------------------------------------------------------------------------

/**
 * The fallback die's 6 faces. A bare number is one contiguous blob of that
 * many cells; a compound face is two independent contiguous blobs, placed
 * anywhere among the player's remaining fillable cells (they need not touch
 * each other or the pair). Compound faces are both-blobs-or-neither — no
 * partial placement.
 */
export type FallbackFaceId = '1' | '2' | '3' | '1+2' | '2+2' | '1+3';

/** Blob sizes a fallback face requires — one entry per blob. */
export const FALLBACK_BLOB_SIZES: Readonly<Record<FallbackFaceId, readonly number[]>> = {
  '1': [1],
  '2': [2],
  '3': [3],
  '1+2': [1, 2],
  '2+2': [2, 2],
  '1+3': [1, 3],
};

/**
 * What the referee issued for a round: a pair offer (two distinct pieces from
 * `SHAPE_LIBRARY`, take-both-or-decline) and an independent fallback offer,
 * both revealed up front — no information gated behind declining (see
 * mechanics-correction.md for why). `issueRoll` (roll.ts) derives both from
 * `deriveSeed(roomSeed, round)` and nothing else.
 */
export interface Roll {
  round: number;
  seed: Seed;
  /** Two distinct piece ids — a pair offer never repeats a piece (decided 2026-08-01). */
  pair: readonly [PieceId, PieceId];
  fallback: FallbackFaceId;
}

/** One piece placed at a chosen orientation and board position. */
export interface PiecePlacement {
  pieceId: PieceId;
  orientation: Orientation;
  /** Where the piece's normalized (0, 0) cell lands on the board. */
  origin: CellRef;
}

/**
 * What a client submits: intent, not result (§5). Atomic pair placement means
 * one move carries both piece placements; a fallback move carries one blob
 * per size the face requires (`FALLBACK_BLOB_SIZES`), matched positionally.
 */
export type MoveChoice =
  | { kind: 'pair'; placements: readonly [PiecePlacement, PiecePlacement] }
  | { kind: 'fallback'; blobs: readonly (readonly CellRef[])[] };

export interface Move {
  playerId: PlayerId;
  round: number;
  choice: MoveChoice;
}

export type MoveRejection =
  | 'wrong-round'
  | 'unknown-piece'
  | 'out-of-bounds'
  | 'cell-not-fillable'
  | 'cell-already-filled'
  | 'overlapping-placement'
  | 'not-offered'
  | 'blob-size-mismatch'
  | 'blob-not-contiguous'
  | 'incomplete-compound-choice';

export type MoveResult = { ok: true; board: Board } | { ok: false; reason: MoveRejection };

// ---------------------------------------------------------------------------
// Room state
// ---------------------------------------------------------------------------

export type RoomPhase = 'lobby' | 'rolling' | 'filling' | 'scoring' | 'finished';

/**
 * Kept close to the Phase 0 shape deliberately: Phase 4 ("Room state in the
 * Durable Object") owns this type's real design. The one thing Phase 1 had to
 * settle first — whether a session plays one picture or cycles through
 * several, and what ends it — is decided in ROADMAP.md Phase 1 and
 * docs/mechanics-correction.md (session-end note): a session cycles through
 * its pack's pictures, ending on piece-pool exhaustion. `boards` below models
 * the *current* picture's boards; picture-cycling and pool bookkeeping are
 * additive fields Phase 4 introduces, not a reshape of what's already here.
 */
export interface RoomState {
  code: RoomCode;
  mode: GameMode;
  phase: RoomPhase;
  seed: Seed;
  round: number;
  players: readonly Player[];
  /** One board in same-board mode; one per player in own-board mode. */
  boards: Readonly<Record<PlayerId, Board>>;
  currentRoll: Roll | null;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export interface PlayerScore {
  playerId: PlayerId;
  filled: number;
  total: number;
  /** 0..1 */
  completion: number;
  points: number;
}

export interface RoundResult {
  round: number;
  scores: readonly PlayerScore[];
  complete: boolean;
}
