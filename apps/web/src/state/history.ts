/**
 * Completed solo and daily results, kept on this device (ROADMAP.md Phase 7b,
 * decided 2026-10-22). This is local-only: no accounts exist (CLAUDE.md §1),
 * and nothing needs results from other players until a leaderboard is
 * actually wanted. Per-room SQLite in the Durable Object, or D1, waits for
 * that. Rooms are not recorded here; their results live in the room.
 *
 * Stored as one small JSON array in `localStorage`, newest first, capped. A
 * value that fails to parse or has the wrong shape is dropped, never
 * trusted: localStorage is user-editable, and a corrupt history must not
 * break Home.
 */

export interface ResultEntry {
  kind: 'solo' | 'daily';
  /** The daily's date (`YYYY-MM-DD`, UTC); `null` for an ordinary solo game. */
  daily: string | null;
  packId: string;
  pictureId: string;
  /** Rounds used, 1-based (what the player saw on the HUD). */
  rounds: number;
  /** When it was completed, ISO 8601. */
  completedAt: string;
}

const KEY = 'pixwagon.history';
/** Enough for "recent results" and a daily streak later; small enough that
 *  the array never matters for storage quota. */
export const HISTORY_LIMIT = 50;

function isEntry(value: unknown): value is ResultEntry {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    (v.kind === 'solo' || v.kind === 'daily') &&
    (v.daily === null || typeof v.daily === 'string') &&
    typeof v.packId === 'string' &&
    typeof v.pictureId === 'string' &&
    typeof v.rounds === 'number' &&
    typeof v.completedAt === 'string'
  );
}

export function loadHistory(): ResultEntry[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    // Unparseable or storage blocked: start from an empty history.
    return [];
  }
}

/**
 * Add a completed result, newest first. A daily counts once: completing the
 * same date again (a second device tab, say) keeps the first result rather
 * than overwriting it.
 */
export function recordResult(entry: ResultEntry): void {
  if (typeof localStorage === 'undefined') return;
  const history = loadHistory();
  if (entry.daily !== null && history.some((e) => e.daily === entry.daily)) return;
  try {
    localStorage.setItem(KEY, JSON.stringify([entry, ...history].slice(0, HISTORY_LIMIT)));
  } catch {
    // Best effort, same as the other localStorage helpers.
  }
}

/** Today's daily result on this device, if it was completed. */
export function dailyResult(history: readonly ResultEntry[], key: string): ResultEntry | null {
  return history.find((entry) => entry.daily === key) ?? null;
}
