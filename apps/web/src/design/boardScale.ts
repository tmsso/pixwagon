import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

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
 * The miniature boards on the results screen use the same three viewport
 * breakpoints at a smaller scale — 5, 8 and 12 px cells (pass 03 Annotation
 * 28). Integer steps for the same reason as the board: no soft edges.
 */
export function resultsCellForViewport(viewportWidth: number): 5 | 8 | 12 {
  if (viewportWidth >= 1180) return 12;
  if (viewportWidth >= 768) return 8;
  return 5;
}

/** The viewport width, kept current on resize. SSR-safe: `window` is only read
 *  inside the effect and the lazy initialiser's guard, so `check-screens.tsx`'s
 *  static render gets the phone width without touching a browser global. */
function useViewportWidth(): number {
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? 390 : window.innerWidth,
  );

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return viewportWidth;
}

export function useResultsCellSize(): 5 | 8 | 12 {
  return resultsCellForViewport(useViewportWidth());
}

/**
 * Re-resolves on viewport resize.
 *
 * `availableWidth` is approximated as the viewport minus the 16px screen
 * padding each side (the design's spacing scale) rather than measured off the
 * DOM — precise enough for the overflow rule and it keeps this a pure function
 * of `window.innerWidth`, so no `ResizeObserver` and nothing for jsdom to miss.
 */
export function useBoardCellSize(boardCols: number): BoardCellSize {
  const viewportWidth = useViewportWidth();
  return resolveBoardCellSize(viewportWidth, boardCols, viewportWidth - 32);
}

/**
 * Pass 04 (BRIEF-04, "Board size", replacing Annotation 11's three steps): the
 * largest whole number of CSS pixels per cell at which a `cols × rows` board
 * fits a `width × height` area, clamped to 12–64. Whole pixels for the same
 * reason the steps existed — a fractional cell draws soft edges — but no
 * longer only 20/28/40, which left a 12×8 board at 480×320 px in a 1440×900
 * window.
 */
export const FIT_CELL_MIN = 12;
export const FIT_CELL_MAX = 64;

export function fitCellSize(cols: number, rows: number, width: number, height: number): number {
  const fit = Math.floor(Math.min(width / Math.max(1, cols), height / Math.max(1, rows)));
  return Math.max(FIT_CELL_MIN, Math.min(FIT_CELL_MAX, Number.isFinite(fit) ? fit : FIT_CELL_MIN));
}

/**
 * `fitCellSize` for the element `ref` points at, kept current with a
 * `ResizeObserver` (a browser API that reports an element's size whenever it
 * changes — window resizes, a phone rotating, the tray growing). Before the
 * first measurement, and in the Node-side screen render, it answers 20, the
 * old phone step, so static renders keep their shape.
 */
export function useFitCellSize(
  ref: RefObject<HTMLElement | null>,
  cols: number,
  rows: number,
): number {
  const [size, setSize] = useState(20);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      setSize(fitCellSize(cols, rows, width, height));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, cols, rows]);
  return size;
}
