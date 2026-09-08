/**
 * The install-prompt lifecycle, as a pure state machine (ROADMAP.md Phase 3,
 * design pass 02 Annotation 16).
 *
 * Rules the annotation fixes:
 *  - never on first load — the prompt only becomes `eligible` after the player
 *    finishes a picture, "the one moment the app has earned it";
 *  - "Not now" suppresses it for 30 days;
 *  - a second dismissal retires it permanently, leaving only the quiet ghost
 *    button on Home (surface 08b).
 *
 * No account exists to sync this to, so it lives in localStorage — and that is
 * fine (Annotation 16). This module is storage- and DOM-free so it can be unit
 * tested directly; `usePwaStore` does the persistence.
 */

export type InstallState =
  | { kind: 'ineligible' } // before the first completed picture, or already installed
  | { kind: 'eligible' }
  | { kind: 'suppressed'; until: number } // epoch ms the 30-day window ends
  | { kind: 'retired' };

export const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const INITIAL_INSTALL_STATE: InstallState = { kind: 'ineligible' };

/** Finishing a picture makes an `ineligible` prompt `eligible`. Everything else
 *  (already suppressed, retired, or installed→ineligible) is left untouched — a
 *  completion is not a reason to re-nag someone who already said no. */
export function markEligible(state: InstallState): InstallState {
  return state.kind === 'ineligible' ? { kind: 'eligible' } : state;
}

/** Whether the full install card shows: eligible, or a suppression that has
 *  lapsed (the 30 days are up and it gets one more ask before retiring). */
export function isCardVisible(state: InstallState, now: number): boolean {
  if (state.kind === 'eligible') return true;
  return state.kind === 'suppressed' && now >= state.until;
}

/** Whether the quiet ghost "Add to home screen" button shows instead: the
 *  prompt has been dismissed at least once (suppressed or retired) and the full
 *  card is not currently up. */
export function isGhostVisible(state: InstallState, now: number): boolean {
  if (isCardVisible(state, now)) return false;
  return state.kind === 'suppressed' || state.kind === 'retired';
}

/** "Not now". First dismissal → 30-day suppression; dismissing again once the
 *  card has come back → retired for good. */
export function dismiss(state: InstallState, now: number): InstallState {
  if (state.kind === 'eligible') return { kind: 'suppressed', until: now + THIRTY_DAYS_MS };
  if (state.kind === 'suppressed') return { kind: 'retired' };
  return state;
}

/** The app is now installed — nothing install-related should ever show again. */
export function markInstalled(): InstallState {
  return { kind: 'ineligible' };
}

/** Parse a persisted value defensively — an unknown or malformed shape resets
 *  to the initial state rather than throwing into render. */
export function parseInstallState(raw: unknown): InstallState {
  if (typeof raw !== 'object' || raw === null) return INITIAL_INSTALL_STATE;
  const value = raw as Record<string, unknown>;
  switch (value.kind) {
    case 'ineligible':
    case 'eligible':
    case 'retired':
      return { kind: value.kind };
    case 'suppressed':
      return typeof value.until === 'number'
        ? { kind: 'suppressed', until: value.until }
        : INITIAL_INSTALL_STATE;
    default:
      return INITIAL_INSTALL_STATE;
  }
}
