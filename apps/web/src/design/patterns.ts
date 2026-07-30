import type { CSSProperties } from 'react';
import type { PlayerPattern } from './tokens.ts';

/**
 * Turns a player's colour + pattern token into an inline background.
 *
 * This is the mechanism behind "colour is never the sole signal". Two players
 * whose hues are indistinguishable to a given viewer still differ by hatch, so a
 * filled board stays readable in greyscale, in a screenshot, and to someone with
 * any of the common colour-vision deficiencies.
 *
 * Inline styles rather than Tailwind classes because the colour comes from
 * runtime data (which seat a player took), not from a fixed class set — and
 * because the Canvas renderer will need to reproduce these same hatches, so
 * keeping the geometry described in one place makes that port straightforward.
 */
export function patternStyle(pattern: PlayerPattern, hex: string): CSSProperties {
  const faint = `${hex}33`;

  switch (pattern) {
    case 'solid':
      return { backgroundColor: hex };
    case 'diagonal':
      return {
        backgroundColor: faint,
        backgroundImage: `repeating-linear-gradient(45deg, ${hex} 0 3px, transparent 3px 6px)`,
      };
    case 'horizontal':
      return {
        backgroundColor: faint,
        backgroundImage: `repeating-linear-gradient(0deg, ${hex} 0 2px, transparent 2px 5px)`,
      };
    case 'vertical':
      return {
        backgroundColor: faint,
        backgroundImage: `repeating-linear-gradient(90deg, ${hex} 0 2px, transparent 2px 5px)`,
      };
    case 'cross':
      return {
        backgroundColor: faint,
        backgroundImage: [
          `repeating-linear-gradient(0deg, ${hex} 0 2px, transparent 2px 6px)`,
          `repeating-linear-gradient(90deg, ${hex} 0 2px, transparent 2px 6px)`,
        ].join(', '),
      };
    case 'dots':
      return {
        backgroundColor: faint,
        backgroundImage: `radial-gradient(${hex} 40%, transparent 42%)`,
        backgroundSize: '5px 5px',
      };
  }
}
