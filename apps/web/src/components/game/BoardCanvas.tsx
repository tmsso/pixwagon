import { useEffect, useRef } from 'react';
import type { Board, CellRef } from '@pixwagon/game-core';
import { paintCellFill } from '../../design/canvasPatterns.ts';
import { playerColor } from '../../design/tokens.ts';

export interface BoardCanvasProps {
  board: Board;
  /** Rendered pixel size of one grid cell at 1× device pixel ratio. */
  cellSize?: number;
  /** Whose hatch fills `filled` cells. Solo has one player, so this is a
   *  constant — per-cell player attribution is a same-board (Phase 5) concern,
   *  and `CellState` deliberately doesn't carry a player id (game-core/types.ts). */
  colorIndex?: number;
  onCellPress?: (cell: CellRef) => void;
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
export function BoardCanvas({ board, cellSize = 20, colorIndex = 0, onCellPress }: BoardCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { width, height } = board.size;

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
  }, [board, width, height, cellSize, colorIndex]);

  return (
    <canvas
      ref={ref}
      className="touch-manipulation rounded-lg border border-border"
      role="grid"
      aria-label={`Board, ${width} by ${height}`}
      onPointerDown={(event) => {
        if (!onCellPress) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const x = Math.floor((event.clientX - rect.left) / cellSize);
        const y = Math.floor((event.clientY - rect.top) / cellSize);
        if (x >= 0 && y >= 0 && x < width && y < height) onCellPress({ x, y });
      }}
    />
  );
}
