import { useEffect, useState } from 'react';

/**
 * Whether a CSS media query matches, kept current. Used where a layout choice
 * changes *which* components render (the play table's side panel), which a
 * Tailwind breakpoint class can't do on its own. SSR-safe: the Node-side
 * screen render (`scripts/check-screens.tsx`) gets `fallback`.
 */
export function useMediaQuery(query: string, fallback = false): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' || !window.matchMedia
      ? fallback
      : window.matchMedia(query).matches,
  );
  useEffect(() => {
    if (!window.matchMedia) return;
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);
  return matches;
}

/** BRIEF-04 "Layouts": the side-panel arrangement whenever the screen is
 *  wider than tall and at least 600 px wide. That includes a phone held
 *  sideways (667×375, 844×390): stacked, it would leave the board about 60 px
 *  of height. (The brief said 900 px; changed while building, 2026-11-05.) */
export const WIDE_LAYOUT = '(min-width: 37.5rem) and (orientation: landscape)';
/** A mouse or trackpad is present: show the keyboard/mouse shortcut legend. */
export const FINE_POINTER = '(pointer: fine)';
