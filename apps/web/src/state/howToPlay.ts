import { useState } from 'react';

/**
 * Whether this device has seen How to play (pass 04, BRIEF-04 "Richer
 * surfaces": it opens once on the first visit, then only on request). Guarded
 * like `packChoice.ts`: storage can be missing (Node render) or throw
 * (private mode), and neither may break the game.
 */
const KEY = 'pixwagon:how-to-play-seen';

export function hasSeenHowToPlay(): boolean {
  if (typeof localStorage === 'undefined') return true;
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return true;
  }
}

export function markHowToPlaySeen(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    // Best effort: at worst it shows once more next time.
  }
}

/** `[open, show, close]` — open on first visit, and closing remembers it. */
export function useHowToPlay(): [boolean, () => void, () => void] {
  const [open, setOpen] = useState(() => !hasSeenHowToPlay());
  return [
    open,
    () => setOpen(true),
    () => {
      markHowToPlaySeen();
      setOpen(false);
    },
  ];
}
