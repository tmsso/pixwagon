import { useEffect, useRef } from 'react';

export interface BoardCanvasProps {
  width: number;
  height: number;
  /** Rendered pixel size of one grid cell at 1× device pixel ratio. */
  cellSize?: number;
  onCellPress?: (x: number, y: number) => void;
}

/**
 * Phase 0 shell for the board renderer.
 *
 * Canvas rather than a grid of DOM nodes because a 40×30 board is 1,200 elements
 * and every optimistic fill would touch a slice of them; a canvas redraw is one
 * operation. It also gives crisp integer-scaled pixels on any display, which is
 * the entire visual premise of the game.
 *
 * What is real here: the device-pixel-ratio handling and the pointer→cell
 * mapping, because both are easy to get subtly wrong and are worth having
 * settled before Phase 2 draws anything on top.
 */
export function BoardCanvas({ width, height, cellSize = 16, onCellPress }: BoardCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);

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

    // Phase 2 draws the actual board here. Until then, a visible empty grid so
    // the component is never a silently blank rectangle.
    const styles = getComputedStyle(canvas);
    ctx.fillStyle = styles.getPropertyValue('--color-cell-blank').trim() || '#f6f7f9';
    ctx.fillRect(0, 0, width * cellSize, height * cellSize);
    ctx.strokeStyle = styles.getPropertyValue('--color-border').trim() || '#d3d9e0';
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
  }, [width, height, cellSize]);

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
        if (x >= 0 && y >= 0 && x < width && y < height) onCellPress(x, y);
      }}
    />
  );
}
