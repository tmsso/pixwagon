import { cellAt } from '@pixwagon/game-core';
import type { Board, CellRef, Roll } from '@pixwagon/game-core';
import {
  candidateCells,
  mirrorActivePiece,
  orientedOffsets,
  pieceCellsAt,
  rotateActivePiece,
  setActive,
  stagedPieceCells,
  startFallback,
  startPair,
  type PendingChoice,
  type PendingPiece,
} from './placement.ts';

/**
 * The pass 04 interaction model (BRIEF-04, "pick up, aim, drop, confirm"), as
 * pure functions over `PendingChoice`. No DOM, no React and no store: the
 * pointer layer (`usePlayControls`) turns gestures into these calls, and the
 * stores keep only the result. That split is what lets every gesture's rule be
 * unit-tested without a browser.
 *
 * Vocabulary: a pair piece is **held** when it is the active piece and is not
 * on the board — the ghost then follows the pointer. It is **staged** once it
 * has a board square (`at`). Nothing is sent until ✓ Place.
 */

function sameCell(a: CellRef, b: CellRef): boolean {
  return a.x === b.x && a.y === b.y;
}

/** The pair piece the pointer is carrying, if any. */
export function heldPiece(choice: PendingChoice | null): PendingPiece | null {
  if (choice?.kind !== 'pair') return null;
  const piece = choice.pieces[choice.active];
  return piece.at === null ? piece : null;
}

/** Which staged pair piece covers `cell`, or `null`. */
export function stagedPieceAt(choice: PendingChoice | null, cell: CellRef): 0 | 1 | null {
  if (choice?.kind !== 'pair') return null;
  for (const index of [0, 1] as const) {
    if (stagedPieceCells(choice.pieces[index]).some((c) => sameCell(c, cell))) return index;
  }
  return null;
}

/**
 * Lifts piece `index` off the board so it follows the pointer again. When
 * `grab` is one of its squares, that square becomes the handle — the piece
 * comes up exactly where it was grabbed instead of re-centring on the pointer.
 */
export function pickUp(choice: PendingChoice, index: number, grab?: CellRef): PendingChoice {
  if (choice.kind !== 'pair') return setActive(choice, index);
  const which = index === 1 ? 1 : 0;
  const piece = choice.pieces[which];
  let anchor = piece.anchor;
  if (grab && piece.at) {
    const cells = pieceCellsAt(piece, piece.at);
    const hit = cells.findIndex((c) => sameCell(c, grab));
    if (hit !== -1) anchor = hit;
  }
  const pieces = choice.pieces.map((p, i) => (i === which ? { ...p, anchor, at: null } : p)) as [
    PendingPiece,
    PendingPiece,
  ];
  return { ...choice, pieces, active: which };
}

/**
 * A tap on a tray tile (BRIEF-04: the choice between the offers is implicit).
 * A tile from the other offer — or the first tile of the round — starts that
 * offer fresh, returning anything staged. A staged pair piece's own tile picks
 * it back up; any other tile just becomes the active one.
 */
export function selectTile(
  choice: PendingChoice | null,
  roll: Roll,
  kind: 'pair' | 'fallback',
  index: number,
): PendingChoice {
  const current =
    choice?.kind === kind ? choice : kind === 'pair' ? startPair(roll) : startFallback(roll);
  if (current.kind === 'pair' && current.pieces[index === 1 ? 1 : 0].at !== null) {
    return pickUp(current, index);
  }
  return setActive(current, index);
}

/** Turns piece `index` (held or staged) a quarter clockwise around its handle. */
export function rotatePiece(choice: PendingChoice, index: number): PendingChoice {
  return rotateActivePiece(setActive(choice, index));
}

/** Flips piece `index` (held or staged) around its handle. */
export function mirrorPiece(choice: PendingChoice, index: number): PendingChoice {
  return mirrorActivePiece(setActive(choice, index));
}

/**
 * Undo, before anything is sent: takes back the most recent thing on the
 * board. Pair — the active piece if it is staged, otherwise the other one.
 * Single — the last square of the active blob, or of the blob before it when
 * the active one is empty.
 */
export function undo(choice: PendingChoice): PendingChoice {
  if (choice.kind === 'pair') {
    const order = choice.active === 0 ? ([0, 1] as const) : ([1, 0] as const);
    const target = order.find((index) => choice.pieces[index].at !== null);
    if (target === undefined) return choice;
    return pickUp(choice, target);
  }
  for (let step = 0; step < choice.blobs.length; step += 1) {
    const index = (choice.active - step + choice.blobs.length) % choice.blobs.length;
    const blob = choice.blobs[index]!;
    if (blob.cells.length === 0) continue;
    const blobs = choice.blobs.map((b, i) =>
      i === index ? { ...b, cells: b.cells.slice(0, -1) } : b,
    );
    return { ...choice, blobs, active: index };
  }
  return choice;
}

/** Anything at all on the board yet? (Undo's enabled state.) */
export function hasStaged(choice: PendingChoice | null): boolean {
  return choice !== null && candidateCells(choice).length > 0;
}

export interface Ghost {
  cells: CellRef[];
  /** Every square is fillable and none is taken by another staged piece. */
  fits: boolean;
}

/** The held piece drawn with its handle on `hover`, and whether it fits there. */
export function ghostAt(
  board: Board,
  choice: PendingChoice | null,
  hover: CellRef | null,
): Ghost | null {
  const piece = heldPiece(choice);
  if (!piece || !hover || choice?.kind !== 'pair') return null;
  const cells = pieceCellsAt(piece, hover);
  const taken = choice.pieces.flatMap((p) => (p === piece ? [] : stagedPieceCells(p)));
  const fits = cells.every(
    (c) => cellAt(board, c) === 'fillable' && !taken.some((t) => sameCell(t, c)),
  );
  return { cells, fits };
}

/** Does staged piece `index` still sit on open squares, clear of the other
 *  piece? False after a turn swings part of it off the picture. */
export function stagedFits(board: Board, choice: PendingChoice, index: number): boolean {
  if (choice.kind !== 'pair') return true;
  const piece = choice.pieces[index === 1 ? 1 : 0];
  if (!piece.at) return true;
  const other = stagedPieceCells(choice.pieces[index === 1 ? 0 : 1]);
  return stagedPieceCells(piece).every(
    (c) => cellAt(board, c) === 'fillable' && !other.some((o) => sameCell(o, c)),
  );
}

function isLone(board: Board, cell: CellRef, covered: ReadonlySet<string>): boolean {
  const steps = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;
  return steps.every(([dx, dy]) => {
    const n = { x: cell.x + dx, y: cell.y + dy };
    return cellAt(board, n) !== 'fillable' || covered.has(`${n.x},${n.y}`);
  });
}

/**
 * Squares this move would leave alone: fillable, not covered by the move, and
 * with no fillable neighbour left — only a `1` (or the monomino) can ever fill
 * one, which is how a nearly finished picture stalls (BRIEF-04, D20). Squares
 * that were already alone before the move are not reported; the warning is
 * about what *this* placement does.
 */
export function loneSquaresAfter(board: Board, cells: readonly CellRef[]): CellRef[] {
  if (cells.length === 0) return [];
  const covered = new Set(cells.map((c) => `${c.x},${c.y}`));
  const none = new Set<string>();
  const result: CellRef[] = [];
  const seen = new Set<string>();
  for (const c of cells) {
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const n = { x: c.x + dx, y: c.y + dy };
      const key = `${n.x},${n.y}`;
      if (seen.has(key) || covered.has(key) || cellAt(board, n) !== 'fillable') continue;
      seen.add(key);
      if (isLone(board, n, covered) && !isLone(board, n, none)) result.push(n);
    }
  }
  return result;
}

/** The anchor offset of the held piece — how far its handle sits from the
 *  piece's top-left, for drawing a tray tile's grab point. */
export function handleOffset(piece: PendingPiece): { dx: number; dy: number } {
  return orientedOffsets(piece.pieceId, piece.orientation)[piece.anchor]!;
}

/** What a key does on the play table (BRIEF-04 gesture table). `null` keys
 *  are left to the browser. */
export type KeyAction =
  | { kind: 'rotate' }
  | { kind: 'mirror' }
  | { kind: 'undo' }
  | { kind: 'cancel' }
  | { kind: 'select'; tile: number };

export function keyAction(key: string): KeyAction | null {
  switch (key) {
    case 'r':
    case 'R':
      return { kind: 'rotate' };
    case 'f':
    case 'F':
      return { kind: 'mirror' };
    case 'Backspace':
    case 'Delete':
      return { kind: 'undo' };
    case 'Escape':
      return { kind: 'cancel' };
    case '1':
    case '2':
    case '3':
    case '4':
      return { kind: 'select', tile: Number(key) - 1 };
    default:
      return null;
  }
}
