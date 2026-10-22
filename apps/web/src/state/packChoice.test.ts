import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SOLO_PACK_ID, loadSoloPack, saveSoloPack } from './packChoice.ts';
import { freshSoloConfig } from './soloGame.ts';

describe('solo pack choice (D7)', () => {
  const stored = new Map<string, string>();

  beforeEach(() => {
    stored.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => void stored.set(key, value),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('defaults to the first pack, as solo played before D7', () => {
    expect(loadSoloPack()).toBe(DEFAULT_SOLO_PACK_ID);
    expect(freshSoloConfig()).toMatchObject({ packId: 'transportation', pictureId: 'tram' });
  });

  it('remembers the chosen pack, and Solo plays its first picture', () => {
    saveSoloPack('garden');
    expect(loadSoloPack()).toBe('garden');
    expect(freshSoloConfig()).toMatchObject({ packId: 'garden', pictureId: 'tulip' });
  });

  it('falls back to the default for a pack that no longer exists', () => {
    stored.set('pixwagon.soloPack', 'retired-pack');
    expect(loadSoloPack()).toBe(DEFAULT_SOLO_PACK_ID);
  });
});
