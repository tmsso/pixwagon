import { useEffect, useRef, useState } from 'react';
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
}: BoardCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { width, height } = board.size;
  // Keyboard: the canvas is one tab stop with a roving cursor (Phase 9). The
  // cursor only shows while the board has focus, so a tap never draws it.
  const interactive = onCellPress !== undefined;
  const [cursor, setCursor] = useState<CellRef | null>(null);

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

    // Candidate/invalid overlay last, so it sits above the grid lines rather
    // than under them. Two layers: every candidate cell as the weak ghost
    // (fill + dashed outline), then the active piece/blob's cells again as the
    // strong ghost (heavier fill + solid outline). A rejected move drops the
    // strong/weak split and paints the whole thing in `danger`.
    const strokeColor = invalid ? danger : accent;
    const fillColor = invalid ? danger : accent;
    const activeKeys = new Set(activeCandidateCells.map((cell) => `${cell.x},${cell.y}`));

    if (candidateCells.length > 0) {
      ctx.strokeStyle = strokeColor;
      ctx.fillStyle = fillColor;
      ctx.lineWidth = 1;
      for (const cell of candidateCells) {
        const strong = !invalid && activeKeys.has(`${cell.x},${cell.y}`);
        ctx.globalAlpha = strong ? 0.35 : 0.2;
        ctx.fillRect(cell.x * cellSize, cell.y * cellSize, cellSize, cellSize);
        ctx.globalAlpha = 1;
        ctx.setLineDash(strong ? [] : [4, 3]);
        ctx.strokeRect(
          cell.x * cellSize + 0.5,
          cell.y * cellSize + 0.5,
          cellSize - 1,
          cellSize - 1,
        );
      }
      ctx.setLineDash([]);
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
  ]);

  return (
    <>
      <canvas
        ref={ref}
        className="touch-manipulation rounded-lg border border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
        onPointerDown={(event) => {
          if (!onCellPress) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const x = Math.floor((event.clientX - rect.left) / cellSize);
          const y = Math.floor((event.clientY - rect.top) / cellSize);
          if (x >= 0 && y >= 0 && x < width && y < height) onCellPress({ x, y });
        }}
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
