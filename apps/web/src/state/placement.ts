import { FALLBACK_BLOB_SIZES, getPiece } from '@pixwagon/game-core';
import { applyMove, cellAt } from '@pixwagon/game-core';
import type {
  Board,
  CellRef,
  MoveChoice,
  MoveRejection,
  Orientation,
  PieceId,
  Roll,
} from '@pixwagon/game-core';
import { absolutePieceCells } from './legality.ts';

/**
 * The pending, not-yet-committed choice a player is composing this round —
 * the client-side "candidate" state `docs/design/surfaces/` Annotation 01
 * describes. Pure and DOM-free on purpose: the store (`soloGame.ts`) is the
 * only thing that touches React, so this logic is unit-testable the same way
 * game-core's own pure modules are.
 */

const CANONICAL_ORIENTATION: Orientation = { rotation: 0, mirrored: false };

export interface PendingPiece {
  pieceId: PieceId;
  orientation: Orientation;
  /** Where the piece is anchored; `null` until the player taps the board. */
  origin: CellRef | null;
}

export interface PendingBlob {
  size: number;
  /** Cells chosen so far, in tap order — a blob has no fixed shape, only a
   *  required cell count and (checked at commit time) contiguity. */
  cells: CellRef[];
}

export type PendingChoice =
  | { kind: 'pair'; pieces: readonly [PendingPiece, PendingPiece]; active: 0 | 1 }
  | { kind: 'fallback'; blobs: readonly PendingBlob[]; active: number };

export function startPair(roll: Roll): PendingChoice {
  return {
    kind: 'pair',
    pieces: [
      { pieceId: roll.pair[0], orientation: CANONICAL_ORIENTATION, origin: null },
      { pieceId: roll.pair[1], orientation: CANONICAL_ORIENTATION, origin: null },
    ],
    active: 0,
  };
}

export function startFallback(roll: Roll): PendingChoice {
  return {
    kind: 'fallback',
    blobs: FALLBACK_BLOB_SIZES[roll.fallback].map((size) => ({ size, cells: [] })),
    active: 0,
  };
}

/** Which piece/blob board taps and rotate/mirror presses currently affect. */
export function setActive(choice: PendingChoice, index: number): PendingChoice {
  if (choice.kind === 'pair') {
    return { ...choice, active: index === 1 ? 1 : 0 };
  }
  return { ...choice, active: Math.max(0, Math.min(index, choice.blobs.length - 1)) };
}

function rotate90(orientation: Orientation): Orientation {
  const next = ((orientation.rotation + 90) % 360) as Orientation['rotation'];
  return { rotation: next, mirrored: orientation.mirrored };
}

export function rotateActivePiece(choice: PendingChoice): PendingChoice {
  if (choice.kind !== 'pair') return choice;
  const pieces = choice.pieces.map((piece, index) =>
    index === choice.active ? { ...piece, orientation: rotate90(piece.orientation) } : piece,
  ) as [PendingPiece, PendingPiece];
  return { ...choice, pieces };
}

export function mirrorActivePiece(choice: PendingChoice): PendingChoice {
  if (choice.kind !== 'pair') return choice;
  const pieces = choice.pieces.map((piece, index) =>
    index === choice.active
      ? { ...piece, orientation: { ...piece.orientation, mirrored: !piece.orientation.mirrored } }
      : piece,
  ) as [PendingPiece, PendingPiece];
  return { ...choice, pieces };
}

/** Places (or re-places) the active piece's origin. */
export function placeActiveOrigin(choice: PendingChoice, origin: CellRef): PendingChoice {
  if (choice.kind !== 'pair') return choice;
  const pieces = choice.pieces.map((piece, index) =>
    index === choice.active ? { ...piece, origin } : piece,
  ) as [PendingPiece, PendingPiece];
  // Once the active piece is placed, hand focus to whichever piece still
  // isn't — a plain two-tap flow needs no explicit "switch piece" step for
  // the common case; clicking a piece card still overrides this manually.
  const other = choice.active === 0 ? 1 : 0;
  const active = pieces[other]!.origin === null ? (other as 0 | 1) : choice.active;
  return { ...choice, pieces, active };
}

function sameCell(a: CellRef, b: CellRef): boolean {
  return a.x === b.x && a.y === b.y;
}

function touches(cells: readonly CellRef[], cell: CellRef): boolean {
  return cells.some((c) => Math.abs(c.x - cell.x) + Math.abs(c.y - cell.y) === 1);
}

/** The largest orthogonally-connected part of `cells` — what a blob keeps when
 *  removing one of its squares splits it in two. Ties keep the part holding
 *  the earliest-tapped square, so the result is stable. */
function largestConnectedPart(cells: readonly CellRef[]): CellRef[] {
  const left = [...cells];
  let best: CellRef[] = [];
  while (left.length > 0) {
    const part = [left.shift()!];
    for (let i = 0; i < part.length; i += 1) {
      for (let j = left.length - 1; j >= 0; j -= 1) {
        if (touches([part[i]!], left[j]!)) part.push(...left.splice(j, 1));
      }
    }
    if (part.length > best.length) best = part;
  }
  // Back in tap order, so the dot row fills the way the player tapped.
  return cells.filter((c) => best.some((b) => sameCell(b, c)));
}

/** The first blob after `from` (wrapping round) that still wants squares, or
 *  `from` itself when every blob is full. */
function nextOpenBlob(blobs: readonly PendingBlob[], from: number): number {
  for (let step = 1; step <= blobs.length; step += 1) {
    const index = (from + step) % blobs.length;
    if (blobs[index]!.cells.length < blobs[index]!.size) return index;
  }
  return from;
}

/**
 * One tap on the board while composing the single. Pass 04 (BRIEF-04, "The
 * single (painting)") replaced pass 02's "contiguity is checked at commit"
 * rule, because that rule let a player compose a move the referee was always
 * going to refuse — the owner's "two 1×1 squares don't fit" report:
 *
 * - a tap on a square already in any blob removes it from that blob (keeping
 *   the larger part if that splits it) and makes that blob the active one;
 * - a tap that touches the active blob grows it;
 * - any other tap **restarts** the active blob at that square — never a silent
 *   no-op, so every tap visibly does something;
 * - a blob that becomes full hands focus to the next blob still wanting
 *   squares (compound faces like `1+2` used to drop the second tap).
 *
 * `board`, when given, makes taps on squares that can't be filled do nothing.
 */
export function toggleBlobCell(choice: PendingChoice, cell: CellRef, board?: Board): PendingChoice {
  if (choice.kind !== 'fallback') return choice;

  const owner = choice.blobs.findIndex((blob) => blob.cells.some((c) => sameCell(c, cell)));
  if (owner !== -1) {
    const blobs = choice.blobs.map((blob, index) =>
      index === owner
        ? { ...blob, cells: largestConnectedPart(blob.cells.filter((c) => !sameCell(c, cell))) }
        : blob,
    );
    return { ...choice, blobs, active: owner };
  }

  if (board && cellAt(board, cell) !== 'fillable') return choice;

  const active = choice.blobs[choice.active]!;
  const grows = active.cells.length < active.size && touches(active.cells, cell);
  const cells = grows ? [...active.cells, cell] : [cell];
  const blobs = choice.blobs.map((blob, index) =>
    index === choice.active ? { ...blob, cells } : blob,
  );
  const next = cells.length === active.size ? nextOpenBlob(blobs, choice.active) : choice.active;
  return { ...choice, blobs, active: next };
}

/** Clears the active piece's placement or the active blob's cells — the
 *  "undo before commit" the roadmap calls for. */
export function clearActive(choice: PendingChoice): PendingChoice {
  if (choice.kind === 'pair') {
    const pieces = choice.pieces.map((piece, index) =>
      index === choice.active ? { ...piece, origin: null } : piece,
    ) as [PendingPiece, PendingPiece];
    return { ...choice, pieces };
  }
  const blobs = choice.blobs.map((blob, index) =>
    index === choice.active ? { ...blob, cells: [] } : blob,
  );
  return { ...choice, blobs };
}

/** Every cell currently staged, across all pieces/blobs — what the board
 *  renders as `candidate`. */
export function candidateCells(choice: PendingChoice): CellRef[] {
  if (choice.kind === 'pair') {
    return choice.pieces
      .filter((piece): piece is PendingPiece & { origin: CellRef } => piece.origin !== null)
      .flatMap((piece) => absolutePieceCells(piece.pieceId, piece.orientation, piece.origin));
  }
  return choice.blobs.flatMap((blob) => blob.cells);
}

/** Just the *active* piece/blob's staged cells. The board renders these as the
 *  strong ghost (accent at 35%, solid border) and everything else in
 *  `candidateCells` as the weak ghost (20%, dashed) — design pass 02's
 *  "Ghost vs. candidate" note, so the player can see which piece Turn/Flip and
 *  the next board tap will act on. */
export function activeCandidateCells(choice: PendingChoice): CellRef[] {
  if (choice.kind === 'pair') {
    const piece = choice.pieces[choice.active];
    return piece.origin ? absolutePieceCells(piece.pieceId, piece.orientation, piece.origin) : [];
  }
  return [...(choice.blobs[choice.active]?.cells ?? [])];
}

/** True once every piece/blob has its full complement of cells staged —
 *  legality (fit, overlap, contiguity) is still `applyMove`'s call at
 *  commit time, this only says "there's a complete choice to submit". */
export function isPendingComplete(choice: PendingChoice): boolean {
  if (choice.kind === 'pair') return choice.pieces.every((piece) => piece.origin !== null);
  return choice.blobs.every((blob) => blob.cells.length === blob.size);
}

/** Total cells the pending choice would fill, if committed right now — the
 *  count the commit button's "Place N squares" label reads off. Orientation
 *  doesn't change a piece's cell count, so this reads the canonical shape. */
export function pendingCellCount(choice: PendingChoice): number {
  if (choice.kind === 'pair') {
    return choice.pieces.reduce((sum, piece) => sum + getPiece(piece.pieceId).cells.length, 0);
  }
  return choice.blobs.reduce((sum, blob) => sum + blob.size, 0);
}

export function toMoveChoice(choice: PendingChoice): MoveChoice {
  if (choice.kind === 'pair') {
    const [a, b] = choice.pieces;
    if (a.origin === null || b.origin === null) {
      throw new Error('toMoveChoice called on an incomplete pair placement');
    }
    return {
      kind: 'pair',
      placements: [
        { pieceId: a.pieceId, orientation: a.orientation, origin: a.origin },
        { pieceId: b.pieceId, orientation: b.orientation, origin: b.origin },
      ],
    };
  }
  return { kind: 'fallback', blobs: choice.blobs.map((blob) => blob.cells) };
}

/** Why ✓ Place can't be pressed yet: the choice is unfinished, or the rules
 *  engine would refuse it. `null` means it is legal. */
export type PendingProblem = 'incomplete' | MoveRejection;

/**
 * The referee's own check, run on the client before the player may commit
 * (pass 04, BRIEF-04 note 1). Counting squares was not enough: a single of `2`
 * on two holes that don't touch has the right count and is still refused. In
 * solo this is the referee; in a room the server still has the last word.
 */
export function pendingProblem(
  board: Board,
  roll: Roll,
  choice: PendingChoice,
): PendingProblem | null {
  if (!isPendingComplete(choice)) return 'incomplete';
  const result = applyMove(board, roll, {
    playerId: 'preview',
    round: roll.round,
    choice: toMoveChoice(choice),
  });
  return result.ok ? null : result.reason;
}

/** One short line saying why a finished choice can't be placed. Plain words,
 *  never "invalid move" (pass 02 Annotation 14). `null` for no message. */
export function problemText(problem: PendingProblem | null): string | null {
  switch (problem) {
    case null:
    case 'incomplete':
      return null;
    case 'overlapping-placement':
      return 'The pieces overlap.';
    case 'cell-already-filled':
      return 'Part of it covers a filled square.';
    case 'out-of-bounds':
    case 'cell-not-fillable':
      return 'Part of it is off the picture.';
    case 'blob-not-contiguous':
      return 'Each group’s squares must touch.';
    default:
      return 'That doesn’t fit there.';
  }
}
