import { displayNameSchema } from '@pixwagon/protocol';

/**
 * The player's display name — no accounts (CLAUDE.md §1), so this is the
 * whole of a player's identity beyond the room's rejoin token. Kept in
 * `localStorage` (not `sessionStorage` like the rejoin token): the name should
 * survive closing the tab, a seat in one particular room should not.
 */

const KEY = 'pixwagon.displayName';

/** What a player is called if they never typed a name (design pass 02 `02d`). */
export const DEFAULT_NAME = 'Guest';

/** A name the server will accept: trimmed, at most 24 characters, never empty. */
export function normaliseName(raw: string | null | undefined): string {
  const trimmed = (raw ?? '').trim().slice(0, 24);
  return displayNameSchema.safeParse(trimmed).success ? trimmed : DEFAULT_NAME;
}

export function loadDisplayName(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(KEY);
  } catch {
    // Storage blocked (private mode, embedded webview) — ask again next time.
    return null;
  }
}

export function saveDisplayName(name: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY, name);
  } catch {
    // Best effort, same as `usePwaStore`.
  }
}
