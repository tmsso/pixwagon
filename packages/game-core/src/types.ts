/**
 * The shared vocabulary. Both the browser and the Durable Object speak this,
 * which is the whole point of game-core being a pure module (architecture.md §4A).
 *
 * Phase 0: these types are deliberate and reviewable; the functions that operate
 * on them are stubs. Phase 1 fills in the logic without changing the shapes here
 * more than it has to — see ROADMAP.md.
 */

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
// Rolls and moves
// ---------------------------------------------------------------------------

export interface Die {
  sides: number;
  value: number;
}

/**
 * What the referee issued for a round. `combo` is the derived set of legal
 * options the dice permit — computing it is a game-core job so the client can
 * show options without asking the server.
 */
export interface Roll {
  round: number;
  seed: Seed;
  dice: readonly Die[];
  combo: readonly ComboOption[];
}

export interface ComboOption {
  id: string;
  /** How many cells this option lets the player fill. */
  cells: number;
  /** Palette/colour constraint the option imposes, if any. */
  colorIndex?: number;
}

/** What a client submits: intent, not result (§5). */
export interface Move {
  playerId: PlayerId;
  round: number;
  comboId: string;
  cells: readonly CellRef[];
}

export type MoveRejection =
  | 'out-of-bounds'
  | 'cell-not-fillable'
  | 'cell-already-filled'
  | 'wrong-round'
  | 'unknown-combo'
  | 'cell-count-mismatch'
  | 'cells-not-contiguous'
  | 'color-mismatch';

export type MoveResult = { ok: true; board: Board } | { ok: false; reason: MoveRejection };

// ---------------------------------------------------------------------------
// Room state
// ---------------------------------------------------------------------------

export type RoomPhase = 'lobby' | 'rolling' | 'filling' | 'scoring' | 'finished';

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
