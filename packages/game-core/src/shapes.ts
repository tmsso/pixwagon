/**
 * The fixed polyomino shape library (docs/mechanics-correction.md).
 *
 * Engine-global, not per-pack: packs stay pictures-only (§2.4/constraint 4).
 * `SHAPE_LIBRARY`'s order and contents are picked from by index when a round
 * issues a pair offer (see roll.ts), which makes this list exactly as
 * load-bearing as the RNG algorithm in rng.ts: reordering or editing it
 * silently changes every seeded room and every past daily puzzle. Changing it
 * is allowed; it must be deliberate and versioned, which is what
 * `shapes.test.ts`'s frozen snapshot exists to catch.
 *
 * v1 scope, decided 2026-08-01: free polyominoes of size 1-4 only (9 shapes —
 * 1 monomino, 1 domino, both trominoes, all 5 tetrominoes). Free polyomino
 * means mirror images collapse to one entry (e.g. the S and Z tetrominoes are
 * the same free piece) — reflection is available to the player at placement
 * time via `Orientation.mirrored`, so storing both fixed/mirrored variants in
 * the library would just be a redundant way to reach cells this module
 * already reaches by orientation.
 */

export type PieceId =
  | 'monomino'
  | 'domino'
  | 'tromino-i'
  | 'tromino-l'
  | 'tetromino-i'
  | 'tetromino-o'
  | 'tetromino-t'
  | 'tetromino-s'
  | 'tetromino-l';

export interface CellOffset {
  dx: number;
  dy: number;
}

export interface Piece {
  id: PieceId;
  /** Canonical (unrotated, unmirrored) footprint, normalized to start at (0, 0). */
  cells: readonly CellOffset[];
}

/**
 * Frozen order — see the module docstring. New pieces may only be appended,
 * never inserted, and existing entries may not be reordered or reshaped.
 */
export const SHAPE_LIBRARY: readonly Piece[] = [
  { id: 'monomino', cells: [{ dx: 0, dy: 0 }] },
  {
    id: 'domino',
    cells: [
      { dx: 0, dy: 0 },
      { dx: 1, dy: 0 },
    ],
  },
  {
    id: 'tromino-i',
    cells: [
      { dx: 0, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 2, dy: 0 },
    ],
  },
  {
    id: 'tromino-l',
    cells: [
      { dx: 0, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
    ],
  },
  {
    id: 'tetromino-i',
    cells: [
      { dx: 0, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 2, dy: 0 },
      { dx: 3, dy: 0 },
    ],
  },
  {
    id: 'tetromino-o',
    cells: [
      { dx: 0, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 1, dy: 1 },
    ],
  },
  {
    id: 'tetromino-t',
    cells: [
      { dx: 0, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 2, dy: 0 },
      { dx: 1, dy: 1 },
    ],
  },
  {
    id: 'tetromino-s',
    cells: [
      { dx: 1, dy: 0 },
      { dx: 2, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 1, dy: 1 },
    ],
  },
  {
    id: 'tetromino-l',
    cells: [
      { dx: 0, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: 2 },
      { dx: 1, dy: 2 },
    ],
  },
];

/**
 * Runtime membership check — the type-checker enforces `PieceId` at compile
 * time, but a `pieceId` arriving over the wire is only validated as a
 * non-empty string (protocol/src/index.ts); this is the actual "is it real"
 * check the referee runs before trusting one (`applyMove`'s `unknown-piece`).
 */
export function isKnownPiece(id: string): id is PieceId {
  return SHAPE_LIBRARY.some((piece) => piece.id === id);
}

export function getPiece(id: PieceId): Piece {
  const piece = SHAPE_LIBRARY.find((candidate) => candidate.id === id);
  if (!piece) throw new Error(`unknown piece id "${id}"`);
  return piece;
}

// ---------------------------------------------------------------------------
// Orientation
// ---------------------------------------------------------------------------

export type Rotation = 0 | 90 | 180 | 270;

/**
 * A placement's orientation, chosen freely by the player at placement time
 * (docs/mechanics-correction.md) — not derived from the roll. Deliberately a
 * pair of primitive fields rather than an index into some enumeration: it is
 * then self-describing on the wire (protocol/src/index.ts) and doesn't depend
 * on this module's internal iteration order staying stable.
 */
export interface Orientation {
  rotation: Rotation;
  mirrored: boolean;
}

/** The 8 possible orientations (4 rotations × mirrored or not) — fixed, not per-piece. */
export const ALL_ORIENTATIONS: readonly Orientation[] = ([0, 90, 180, 270] as const).flatMap(
  (rotation) => [
    { rotation, mirrored: false },
    { rotation, mirrored: true },
  ],
);

function rotate90(cells: readonly CellOffset[]): CellOffset[] {
  // Clockwise in this grid's y-down convention. The choice of "clockwise" isn't
  // load-bearing (nothing outside this module assumes a direction) — only that
  // applying it 4 times returns to the original shape, which normalize() below
  // makes checkable.
  return cells.map(({ dx, dy }) => ({ dx: -dy, dy: dx }));
}

function mirrorX(cells: readonly CellOffset[]): CellOffset[] {
  return cells.map(({ dx, dy }) => ({ dx: -dx, dy }));
}

/** Shifts a cell set so its minimum x and y are both 0, then sorts for a stable key. */
export function normalize(cells: readonly CellOffset[]): CellOffset[] {
  const minDx = Math.min(...cells.map((c) => c.dx));
  const minDy = Math.min(...cells.map((c) => c.dy));
  return cells
    .map((c) => ({ dx: c.dx - minDx, dy: c.dy - minDy }))
    .sort((a, b) => a.dy - b.dy || a.dx - b.dx);
}

export function cellKey(cells: readonly CellOffset[]): string {
  return cells.map((c) => `${c.dx},${c.dy}`).join('|');
}

/** Applies an orientation to a piece's canonical cells, normalized to start at (0, 0). */
export function cellsAt(piece: Piece, orientation: Orientation): readonly CellOffset[] {
  const rotations = orientation.rotation / 90;
  let cells = piece.cells;
  for (let i = 0; i < rotations; i += 1) cells = rotate90(cells);
  if (orientation.mirrored) cells = mirrorX(cells);
  return normalize(cells);
}

/**
 * The orientations that produce a visually distinct footprint for this piece,
 * deduped — e.g. the O-tetromino has exactly 1 (all 8 orientations coincide),
 * the S-tetromino has 4 (rotation matters, mirroring doesn't add anything
 * rotation hasn't already produced). Order follows `ALL_ORIENTATIONS`; it is
 * not itself a frozen contract the way `SHAPE_LIBRARY`'s order is; see the
 * module docstring.
 */
export function distinctOrientationsOf(piece: Piece): readonly Orientation[] {
  const seen = new Set<string>();
  const result: Orientation[] = [];
  for (const orientation of ALL_ORIENTATIONS) {
    const key = cellKey(cellsAt(piece, orientation));
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(orientation);
  }
  return result;
}
