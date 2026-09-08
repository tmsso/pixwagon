import { describe, expect, it } from 'vitest';
import {
  dismiss,
  INITIAL_INSTALL_STATE,
  isCardVisible,
  isGhostVisible,
  markEligible,
  markInstalled,
  parseInstallState,
  THIRTY_DAYS_MS,
  type InstallState,
} from './installState.ts';

const T0 = 1_000_000_000_000;

describe('install-prompt state machine', () => {
  it('shows nothing before a picture is finished (never on first load)', () => {
    expect(isCardVisible(INITIAL_INSTALL_STATE, T0)).toBe(false);
    expect(isGhostVisible(INITIAL_INSTALL_STATE, T0)).toBe(false);
  });

  it('a completed picture makes it eligible, and the card shows', () => {
    const state = markEligible(INITIAL_INSTALL_STATE);
    expect(state).toEqual({ kind: 'eligible' });
    expect(isCardVisible(state, T0)).toBe(true);
    expect(isGhostVisible(state, T0)).toBe(false);
  });

  it('"Not now" suppresses the card for 30 days and shows the ghost button', () => {
    const suppressed = dismiss({ kind: 'eligible' }, T0);
    expect(suppressed).toEqual({ kind: 'suppressed', until: T0 + THIRTY_DAYS_MS });
    expect(isCardVisible(suppressed, T0 + THIRTY_DAYS_MS - 1)).toBe(false);
    expect(isGhostVisible(suppressed, T0 + THIRTY_DAYS_MS - 1)).toBe(true);
  });

  it('after 30 days the card returns for one more ask', () => {
    const suppressed: InstallState = { kind: 'suppressed', until: T0 + THIRTY_DAYS_MS };
    expect(isCardVisible(suppressed, T0 + THIRTY_DAYS_MS)).toBe(true);
    expect(isGhostVisible(suppressed, T0 + THIRTY_DAYS_MS)).toBe(false);
  });

  it('a second dismissal retires it permanently, ghost button stays', () => {
    const suppressed = dismiss({ kind: 'eligible' }, T0);
    const retired = dismiss(suppressed, T0 + THIRTY_DAYS_MS);
    expect(retired).toEqual({ kind: 'retired' });
    expect(isCardVisible(retired, T0 + 10 * THIRTY_DAYS_MS)).toBe(false);
    expect(isGhostVisible(retired, T0 + 10 * THIRTY_DAYS_MS)).toBe(true);
  });

  it('finishing another picture never re-nags a suppressed or retired prompt', () => {
    const suppressed: InstallState = { kind: 'suppressed', until: T0 + THIRTY_DAYS_MS };
    expect(markEligible(suppressed)).toBe(suppressed);
    expect(markEligible({ kind: 'retired' })).toEqual({ kind: 'retired' });
  });

  it('installing clears everything for good', () => {
    expect(markInstalled()).toEqual({ kind: 'ineligible' });
    expect(isCardVisible(markInstalled(), T0)).toBe(false);
    expect(isGhostVisible(markInstalled(), T0)).toBe(false);
  });

  it('parses persisted values defensively', () => {
    expect(parseInstallState({ kind: 'eligible' })).toEqual({ kind: 'eligible' });
    expect(parseInstallState({ kind: 'suppressed', until: 42 })).toEqual({
      kind: 'suppressed',
      until: 42,
    });
    expect(parseInstallState({ kind: 'suppressed' })).toEqual(INITIAL_INSTALL_STATE);
    expect(parseInstallState('nonsense')).toEqual(INITIAL_INSTALL_STATE);
    expect(parseInstallState(null)).toEqual(INITIAL_INSTALL_STATE);
    expect(parseInstallState({ kind: 'bogus' })).toEqual(INITIAL_INSTALL_STATE);
  });
});
