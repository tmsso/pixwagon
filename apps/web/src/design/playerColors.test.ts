import { describe, expect, it } from 'vitest';
import { MAX_PLAYERS } from '@pixwagon/protocol';
import { playerColors } from './tokens.ts';

/**
 * The seat count has one canonical definition — `MAX_PLAYERS` in
 * `@pixwagon/protocol`, which the server reads directly (it can't import this
 * palette). This locks the web side to it: the day someone adds a seventh
 * player colour without bumping `MAX_PLAYERS`, or vice versa, CI fails here
 * instead of a seventh player silently getting seat 0's colour and hatch.
 * (ROADMAP.md Phase 4.)
 */
describe('player palette vs. protocol seat count', () => {
  it('has exactly MAX_PLAYERS distinct identities', () => {
    expect(playerColors).toHaveLength(MAX_PLAYERS);
  });

  it('every identity is a unique hue and a unique hatch', () => {
    expect(new Set(playerColors.map((c) => c.hex)).size).toBe(MAX_PLAYERS);
    expect(new Set(playerColors.map((c) => c.pattern)).size).toBe(MAX_PLAYERS);
  });
});
