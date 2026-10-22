import { getPack, packs } from '@pixwagon/packs';

/**
 * The pack solo plays (D7, 2026-10-22): picked on the pack picker
 * (`/packs`) and remembered in `localStorage`, so "Solo" on Home starts the
 * last pack chosen. Rooms don't use this — there the host picks, and the
 * choice lives in room storage on the server.
 *
 * Provisional: design pass 03 (`docs/design/BRIEF-03.md`, Part B) may move
 * the choice elsewhere; this is the smallest version that makes the picker
 * do something.
 */

const KEY = 'pixwagon.soloPack';

/** The first registered pack — what solo played before D7. */
export const DEFAULT_SOLO_PACK_ID = packs[0]!.id;

/** The remembered pack, or the default when nothing (or a pack that no
 *  longer exists) is stored. */
export function loadSoloPack(): string {
  if (typeof localStorage === 'undefined') return DEFAULT_SOLO_PACK_ID;
  try {
    const stored = localStorage.getItem(KEY);
    return stored && getPack(stored) ? stored : DEFAULT_SOLO_PACK_ID;
  } catch {
    // Storage blocked (private mode, embedded webview): the default pack.
    return DEFAULT_SOLO_PACK_ID;
  }
}

export function saveSoloPack(packId: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY, packId);
  } catch {
    // Best effort, same as `displayName.ts`.
  }
}
