import { useEffect, useState } from 'react';

/**
 * Board cell size in CSS pixels — three integer steps and nothing between them
 * (design pass 02, Annotation 11). A Canvas board drawn at a fractional cell
 * size renders soft edges, the one thing a pixel-placement game cannot afford,
 * so this never interpolates:
 *
 *   viewport < 768px   → 20   (phone)
 *   768–1179px         → 28   (tablet)
 *   ≥ 1180px           → 40   (desktop)
 *
 * Second rule from the same annotation: if the board at the chosen step would
 * be wider than the space it has, drop a step rather than fit-to-width. 20 is
 * the floor — below that the board just gets centred with more margin.
 */

export const BOARD_CELL_STEPS = [20, 28, 40] as const;
export type BoardCellSize = (typeof BOARD_CELL_STEPS)[number];

/** The step the viewport width alone selects, before the overflow check. */
export function stepForViewport(viewportWidth: number): BoardCellSize {
  if (viewportWidth >= 1180) return 40;
  if (viewportWidth >= 768) return 28;
  return 20;
}

/**
 * The step to actually draw at: the viewport's step, dropped one at a time
 * while `boardCols` cells wide would overflow `availableWidth`, never below 20.
 */
export function resolveBoardCellSize(
  viewportWidth: number,
  boardCols: number,
  availableWidth: number,
): BoardCellSize {
  const start = BOARD_CELL_STEPS.indexOf(stepForViewport(viewportWidth));
  for (let i = start; i > 0; i -= 1) {
    if (boardCols * BOARD_CELL_STEPS[i]! <= availableWidth) return BOARD_CELL_STEPS[i]!;
  }
  return 20;
}

/**
 * Re-resolves on viewport resize. SSR-safe: `window` is only read inside the
 * effect and the lazy initialiser's guard, so `check-screens.tsx`'s static
 * render gets the phone step without touching a browser global.
 *
 * `availableWidth` is approximated as the viewport minus the 16px screen
 * padding each side (the design's spacing scale) rather than measured off the
 * DOM — precise enough for the overflow rule and it keeps this a pure function
 * of `window.innerWidth`, so no `ResizeObserver` and nothing for jsdom to miss.
 */
export function useBoardCellSize(boardCols: number): BoardCellSize {
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? 390 : window.innerWidth,
  );

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return resolveBoardCellSize(viewportWidth, boardCols, viewportWidth - 32);
}
