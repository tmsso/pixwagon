import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Board, CellRef } from '@pixwagon/game-core';
import { paintCellFill } from '../../design/canvasPatterns.ts';
import { playerColor } from '../../design/tokens.ts';
import { describeCell, initialCursor, moveCursor } from '../../state/boardCursor.ts';

export interface BoardCanvasProps {
  board: Board;
  /** Rendered pixel size of one grid cell at 1× device pixel ratio. */
  cellSize?: number;
  /** Whose hatch fills `filled` cells. Solo has one player, so this is a
   *  constant — per-cell player attribution is a same-board (Phase 5) concern,
   *  and `CellState` deliberately doesn't carry a player id (game-core/types.ts). */
  colorIndex?: number;
  /** Cells staged in the pending choice but not yet committed — the
   *  `candidate` state (`docs/design/surfaces/` Annotation 01). Drawn as the
   *  weak ghost: accent at 20%, dashed border. */
  candidateCells?: readonly CellRef[];
  /** The subset of `candidateCells` belonging to the active piece/blob — the
   *  strong ghost: accent at 35%, solid border (design pass 02, "Ghost vs.
   *  candidate"). Pass a subset of `candidateCells`, not disjoint cells. */
  activeCandidateCells?: readonly CellRef[];
  /** True while briefly showing `applyMove`'s rejection on the candidate
   *  cells before they clear — the `invalid` state. */
  invalid?: boolean;
  onCellPress?: (cell: CellRef) => void;
  /** Moves keyboard focus onto the board when this turns true — choosing an
   *  offer removes the button that had focus, and the next thing to do is
   *  place it on the board. */
  focusWhen?: boolean;
  /** Pass 04: the held piece drawn at the pointer, and whether it fits there. */
  ghost?: { cells: readonly CellRef[]; fits: boolean } | null;
  /** Pass 04 (D20): squares the staged move would leave alone — a dotted ring. */
  loneCells?: readonly CellRef[];
  /** Pass 04: raw pointer events in board coordinates (`cell` is `null`
   *  outside the board). When given, the board is a direct-manipulation
   *  surface: `touch-action: none` so a drag never scrolls, and right-click
   *  never opens the browser menu. `onCellPress` still serves Enter/Space. */
  onBoardPointer?: (event: BoardPointer) => void;
  /** Mouse wheel over the board; return true when it was used (turned a
   *  piece), so the page doesn't also scroll. */
  onWheelTurn?: (direction: 1 | -1) => boolean;
  onDoubleClick?: () => void;
  /** The keyboard cursor moved (or left) — the play table aims the ghost there. */
  onCursorMove?: (cell: CellRef | null) => void;
  /** The canvas element, for code that maps screen points to squares (a piece
   *  dragged in from the tray). */
  canvasRef?: (canvas: HTMLCanvasElement | null) => void;
}

export interface BoardPointer {
  type: 'down' | 'move' | 'up' | 'leave' | 'cancel';
  cell: CellRef | null;
  pointerId: number;
  /** `mouse`, `touch` or `pen` — hover and the finger offset depend on it. */
  pointerType: string;
  button: number;
  shiftKey: boolean;
}

/**
 * Canvas rather than a grid of DOM nodes because a 40×30 board is 1,200 elements
 * and every optimistic fill would touch a slice of them; a canvas redraw is one
 * operation. It also gives crisp integer-scaled pixels on any display, which is
 * the entire visual premise of the game.
 *
 * `BoardCell.tsx` is the authority on what each cell state looks like in DOM
 * form; this mirrors it via `paintCellFill` for the two states (`blank`,
 * `fillable`, `locked` read straight off design tokens — only `filled` needs the
 * player hatch).
 */
export function BoardCanvas({
  board,
  cellSize = 20,
  colorIndex = 0,
  candidateCells = [],
  activeCandidateCells = [],
  invalid = false,
  onCellPress,
  focusWhen = false,
  ghost = null,
  loneCells = [],
  onBoardPointer,
  onWheelTurn,
  onDoubleClick,
  onCursorMove,
  canvasRef,
}: BoardCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  // The latest wheel handler, read by a listener attached once (below).
  const wheelRef = useRef(onWheelTurn);
  useEffect(() => {
    wheelRef.current = onWheelTurn;
  });
  const { width, height } = board.size;
  // Keyboard: the canvas is one tab stop with a roving cursor (Phase 9). The
  // cursor only shows while the board has focus, so a tap never draws it.
  const interactive = onCellPress !== undefined;
  const [cursor, setCursorState] = useState<CellRef | null>(null);
  const setCursor = (next: CellRef | null | ((c: CellRef | null) => CellRef | null)) => {
    setCursorState((current) => {
      const value = typeof next === 'function' ? next(current) : next;
      if (value !== current) onCursorMove?.(value);
      return value;
    });
  };

  useEffect(() => {
    canvasRef?.(ref.current);
    return () => canvasRef?.(null);
  }, [canvasRef]);

  // React's own onWheel listener is passive, so it can't stop the page from
  // scrolling; turning a piece with the wheel needs a non-passive one.
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      const handler = wheelRef.current;
      if (handler && event.deltaY !== 0 && handler(event.deltaY > 0 ? 1 : -1)) {
        event.preventDefault();
      }
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    if (focusWhen) ref.current?.focus();
  }, [focusWhen]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Back the canvas with real device pixels, then scale the drawing context so
    // all subsequent coordinates stay in CSS pixels. Without this the board is
    // blurry on every phone.
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * cellSize * dpr;
    canvas.height = height * cellSize * dpr;
    canvas.style.width = `${width * cellSize}px`;
    canvas.style.height = `${height * cellSize}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Pixel art must not be smoothed when scaled.
    ctx.imageSmoothingEnabled = false;

    const styles = getComputedStyle(canvas);
    const blank = styles.getPropertyValue('--color-cell-blank').trim() || '#f6f7f9';
    const fillable = styles.getPropertyValue('--color-cell-fillable').trim() || '#d3d9e0';
    const locked = styles.getPropertyValue('--color-cell-locked').trim() || '#adb7c2';
    const border = styles.getPropertyValue('--color-border').trim() || '#d3d9e0';
    const accent = styles.getPropertyValue('--color-accent').trim() || '#2a9d8a';
    const danger = styles.getPropertyValue('--color-danger').trim() || '#d64a3f';
    const color = playerColor(colorIndex);

    ctx.fillStyle = blank;
    ctx.fillRect(0, 0, width * cellSize, height * cellSize);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const state = board.cells[y * width + x];
        const px = x * cellSize;
        const py = y * cellSize;
        switch (state) {
          case 'fillable':
            ctx.fillStyle = fillable;
            ctx.fillRect(px, py, cellSize, cellSize);
            break;
          case 'locked':
            ctx.fillStyle = locked;
            ctx.fillRect(px, py, cellSize, cellSize);
            break;
          case 'filled':
            paintCellFill(ctx, px, py, cellSize, color.pattern, color.hex);
            break;
          case 'blank':
          default:
            break;
        }
      }
    }

    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += 1) {
      ctx.beginPath();
      ctx.moveTo(x * cellSize + 0.5, 0);
      ctx.lineTo(x * cellSize + 0.5, height * cellSize);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += 1) {
      ctx.beginPath();
      ctx.moveTo(0, y * cellSize + 0.5);
      ctx.lineTo(width * cellSize, y * cellSize + 0.5);
      ctx.stroke();
    }

    // Staged/invalid overlay above the grid lines. Pass 04 (BRIEF-04,
    // "Feedback on the board"): every staged square is a strong accent fill
    // with a solid outline; the active piece's squares get a heavier one. A
    // rejected move paints the whole lot in `danger`.
    const activeKeys = new Set(activeCandidateCells.map((cell) => `${cell.x},${cell.y}`));
    for (const cell of candidateCells) {
      const strong = !invalid && activeKeys.has(`${cell.x},${cell.y}`);
      ctx.globalAlpha = invalid ? 0.35 : strong ? 0.7 : 0.55;
      ctx.fillStyle = invalid ? danger : accent;
      ctx.fillRect(cell.x * cellSize, cell.y * cellSize, cellSize, cellSize);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = invalid ? danger : accent;
      ctx.lineWidth = strong ? 2 : 1;
      ctx.strokeRect(cell.x * cellSize + 1, cell.y * cellSize + 1, cellSize - 2, cellSize - 2);
    }
    ctx.lineWidth = 1;

    // The held piece at the pointer. Fits: a lighter accent with a solid 2px
    // outline. Doesn't: a danger outline with a diagonal stroke through each
    // square, so "doesn't fit" never rests on colour alone (CLAUDE.md §6).
    if (ghost) {
      for (const cell of ghost.cells) {
        if (cell.x < 0 || cell.y < 0 || cell.x >= width || cell.y >= height) continue;
        const px = cell.x * cellSize;
        const py = cell.y * cellSize;
        ctx.globalAlpha = ghost.fits ? 0.45 : 0.2;
        ctx.fillStyle = ghost.fits ? accent : danger;
        ctx.fillRect(px, py, cellSize, cellSize);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = ghost.fits ? accent : danger;
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 1, py + 1, cellSize - 2, cellSize - 2);
        if (!ghost.fits) {
          ctx.beginPath();
          ctx.moveTo(px + 3, py + cellSize - 3);
          ctx.lineTo(px + cellSize - 3, py + 3);
          ctx.stroke();
        }
      }
      ctx.lineWidth = 1;
    }

    // A square this move would leave alone (D20): a dotted ring in `warning`.
    if (loneCells.length > 0) {
      const warning = styles.getPropertyValue('--color-warning').trim() || '#e8853a';
      ctx.strokeStyle = warning;
      ctx.lineWidth = 2;
      ctx.setLineDash([2, 3]);
      for (const cell of loneCells) {
        ctx.beginPath();
        ctx.arc(
          cell.x * cellSize + cellSize / 2,
          cell.y * cellSize + cellSize / 2,
          cellSize / 2 - 3,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.lineWidth = 1;
    }

    // The keyboard cursor, last so nothing hides it: a dark outline with a
    // light one inside it, so it reads on every square colour and in both
    // themes (never colour alone — it is also the only thick outline).
    if (cursor) {
      const ink = styles.getPropertyValue('--color-ink').trim() || '#171c21';
      const surface = styles.getPropertyValue('--color-surface').trim() || '#ffffff';
      ctx.setLineDash([]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = ink;
      ctx.strokeRect(cursor.x * cellSize + 1, cursor.y * cellSize + 1, cellSize - 2, cellSize - 2);
      ctx.lineWidth = 1;
      ctx.strokeStyle = surface;
      ctx.strokeRect(
        cursor.x * cellSize + 2.5,
        cursor.y * cellSize + 2.5,
        cellSize - 5,
        cellSize - 5,
      );
    }
  }, [
    board,
    width,
    height,
    cellSize,
    colorIndex,
    candidateCells,
    activeCandidateCells,
    invalid,
    cursor,
    ghost,
    loneCells,
  ]);

  function cellFromEvent(event: ReactPointerEvent<HTMLCanvasElement>): CellRef | null {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / cellSize);
    const y = Math.floor((event.clientY - rect.top) / cellSize);
    return x >= 0 && y >= 0 && x < width && y < height ? { x, y } : null;
  }

  function toBoardPointer(
    type: BoardPointer['type'],
    event: ReactPointerEvent<HTMLCanvasElement>,
  ): BoardPointer {
    return {
      type,
      cell: cellFromEvent(event),
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      button: event.button,
      shiftKey: event.shiftKey,
    };
  }

  return (
    <>
      <canvas
        ref={ref}
        className={[
          onBoardPointer ? 'touch-none select-none' : 'touch-manipulation',
          'rounded-lg border border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        ].join(' ')}
        // `application`, not `grid`: a canvas has no cells for a grid to
        // contain, and this one handles its own arrow keys.
        role="application"
        aria-roledescription="board"
        aria-label={`Board, ${width} by ${height}`}
        aria-describedby={interactive ? 'board-keys-hint' : undefined}
        tabIndex={interactive ? 0 : undefined}
        onFocus={(event) => {
          // The cursor is for keyboard users. A tap focuses the canvas too (it
          // is a tab stop), and so does `focusWhen` after a tap on an offer;
          // neither matches `:focus-visible`, which is the browser's own
          // "this focus came from the keyboard" test, so touch never sees it.
          if (interactive && event.currentTarget.matches(':focus-visible')) {
            setCursor((current) => current ?? initialCursor(board));
          }
        }}
        onBlur={() => setCursor(null)}
        onKeyDown={(event) => {
          if (!onCellPress || !cursor) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onCellPress(cursor);
            return;
          }
          const next = moveCursor(cursor, event.key, board);
          if (next) {
            event.preventDefault();
            setCursor(next);
          }
        }}
        onContextMenu={onBoardPointer ? (event) => event.preventDefault() : undefined}
        onDoubleClick={onDoubleClick}
        onPointerDown={(event) => {
          if (onBoardPointer) {
            // Keep receiving this pointer's moves even off the board, so a
            // drag that leaves and comes back is still one drag.
            event.currentTarget.setPointerCapture?.(event.pointerId);
            onBoardPointer(toBoardPointer('down', event));
            return;
          }
          if (!onCellPress) return;
          const cell = cellFromEvent(event);
          if (cell) onCellPress(cell);
        }}
        onPointerMove={
          onBoardPointer ? (e) => onBoardPointer(toBoardPointer('move', e)) : undefined
        }
        onPointerUp={onBoardPointer ? (e) => onBoardPointer(toBoardPointer('up', e)) : undefined}
        onPointerLeave={
          onBoardPointer ? (e) => onBoardPointer(toBoardPointer('leave', e)) : undefined
        }
        onPointerCancel={
          onBoardPointer ? (e) => onBoardPointer(toBoardPointer('cancel', e)) : undefined
        }
      />
      {interactive ? (
        <>
          <span id="board-keys-hint" className="sr-only">
            Arrow keys move around the board. Enter or Space places on the highlighted square.
          </span>
          <span role="status" className="sr-only">
            {cursor ? describeCell(board, cursor) : ''}
          </span>
        </>
      ) : null}
    </>
  );
}
