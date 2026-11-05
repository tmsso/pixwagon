import type { PlayerPattern } from './tokens.ts';
import { luma } from '../state/pictureColors.ts';

/**
 * Canvas port of `patternStyle` (patterns.ts) — same hatch families, drawn with
 * 2D primitives instead of a CSS `background-image`, because the board itself
 * renders on Canvas (architecture.md §3 — crisp integer scaling, no smoothing)
 * where a DOM background image isn't available. `patterns.ts`'s own doc comment
 * anticipated this port; keep the two visually in sync if either changes.
 */
export function paintCellFill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  pattern: PlayerPattern,
  hex: string,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();

  if (pattern === 'solid') {
    ctx.fillStyle = hex;
    ctx.fillRect(x, y, size, size);
    ctx.restore();
    return;
  }

  // Every non-solid pattern starts from the same faint wash `patterns.ts` uses,
  // so a cell never reads as fully empty before the hatch strokes land on it.
  ctx.fillStyle = `${hex}33`;
  ctx.fillRect(x, y, size, size);

  ctx.strokeStyle = hex;
  ctx.fillStyle = hex;
  // A period relative to cell size rather than a fixed pixel count: the board
  // renders at wildly different cell sizes (a 14px roll-offer glyph vs. a 32px
  // desktop board), and a fixed stripe width would either vanish or dominate.
  const period = Math.max(3, size / 4);

  switch (pattern) {
    case 'diagonal': {
      ctx.lineWidth = period / 2;
      // Cover past both corners so rotated stripes still fill the clipped square.
      const span = size * 2;
      for (let offset = -span; offset < span; offset += period) {
        ctx.beginPath();
        ctx.moveTo(x + offset, y - size);
        ctx.lineTo(x + offset + size * 2, y + size);
        ctx.stroke();
      }
      break;
    }
    case 'horizontal': {
      ctx.lineWidth = period / 2;
      for (let offset = 0; offset < size; offset += period) {
        ctx.beginPath();
        ctx.moveTo(x, y + offset);
        ctx.lineTo(x + size, y + offset);
        ctx.stroke();
      }
      break;
    }
    case 'vertical': {
      ctx.lineWidth = period / 2;
      for (let offset = 0; offset < size; offset += period) {
        ctx.beginPath();
        ctx.moveTo(x + offset, y);
        ctx.lineTo(x + offset, y + size);
        ctx.stroke();
      }
      break;
    }
    case 'cross': {
      ctx.lineWidth = period / 2;
      for (let offset = 0; offset < size; offset += period) {
        ctx.beginPath();
        ctx.moveTo(x, y + offset);
        ctx.lineTo(x + size, y + offset);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + offset, y);
        ctx.lineTo(x + offset, y + size);
        ctx.stroke();
      }
      break;
    }
    case 'dots': {
      const radius = Math.max(0.75, period / 4);
      for (let dy = period / 2; dy < size; dy += period) {
        for (let dx = period / 2; dx < size; dx += period) {
          ctx.beginPath();
          ctx.arc(x + dx, y + dy, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
  }

  ctx.restore();
}

/**
 * A filled square in the picture's own colour (pass 04, D19), with a 45°
 * hatch as texture so a filled square never differs from an open one by
 * colour alone: 16% white on most swatches, 7% ink on light ones (luma over
 * 200, like the Tram's windows) where white would vanish. `textured: false`
 * drops the hatch — the finished picture shows clean (handoff-04).
 */
export function paintPictureFill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  hex: string,
  textured: boolean,
): void {
  ctx.fillStyle = hex;
  ctx.fillRect(x, y, size, size);
  if (!textured || size < 8) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  ctx.strokeStyle = luma(hex) > 200 ? 'rgba(23, 28, 33, 0.07)' : 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = Math.max(1, size / 10);
  const period = Math.max(4, size / 4);
  for (let k = -size; k < size * 2; k += period) {
    ctx.beginPath();
    ctx.moveTo(x + k, y + size);
    ctx.lineTo(x + k + size, y);
    ctx.stroke();
  }
  ctx.restore();
}
