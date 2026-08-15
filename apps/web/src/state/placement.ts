import { FALLBACK_BLOB_SIZES, getPiece } from '@pixwagon/game-core';
import type { CellRef, MoveChoice, Orientation, PieceId, Roll } from '@pixwagon/game-core';
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

/** Toggles a cell in the active blob: adds it if there's room, removes it if
 *  already chosen. Contiguity isn't enforced tap-by-tap — only at commit —
 *  so a player can freely backtrack without the UI blocking a valid detour. */
export function toggleBlobCell(choice: PendingChoice, cell: CellRef): PendingChoice {
  if (choice.kind !== 'fallback') return choice;
  const blobs = choice.blobs.map((blob, index) => {
    if (index !== choice.active) return blob;
    const exists = blob.cells.some((c) => c.x === cell.x && c.y === cell.y);
    if (exists)
      return { ...blob, cells: blob.cells.filter((c) => c.x !== cell.x || c.y !== cell.y) };
    if (blob.cells.length >= blob.size) return blob;
    return { ...blob, cells: [...blob.cells, cell] };
  });
  return { ...choice, blobs };
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
