import { describe, expect, it } from 'vitest';
import { issueRoll } from '@pixwagon/game-core';
import { packs } from '@pixwagon/packs';
import { dailyConfig, dailyKey, dailyPicture, dailySeed } from './daily.ts';

describe('daily puzzle (Phase 7a)', () => {
  it('keys on the UTC date, so two time zones get the same puzzle at the same moment', () => {
    // 23:30 in New York on the 21st is already the 22nd in UTC (and Budapest).
    expect(dailyKey(new Date('2026-10-21T23:30:00-04:00'))).toBe('2026-10-22');
    expect(dailyKey(new Date('2026-10-22T01:30:00+02:00'))).toBe('2026-10-21');
  });

  it('is a pure function of the date — two devices derive identical sessions', () => {
    const at = new Date('2026-10-22T12:00:00Z');
    expect(dailyConfig(at)).toEqual(dailyConfig(new Date('2026-10-22T23:59:59Z')));
    expect(dailyConfig(at)).toMatchObject({ roomSeed: 'daily-2026-10-22', daily: '2026-10-22' });
    // Same seed → same offers, round by round (docs/contracts/rng.md).
    expect(issueRoll(dailySeed('2026-10-22'), 5)).toEqual(issueRoll('daily-2026-10-22', 5));
  });

  it('rotates through every pack picture before repeating one', () => {
    const total = packs.reduce((sum, pack) => sum + pack.pictures.length, 0);
    const seen = new Set<string>();
    for (let d = 0; d < total; d += 1) {
      const key = dailyKey(new Date(Date.UTC(2026, 9, 1 + d)));
      const { packId, pictureId } = dailyPicture(key);
      seen.add(`${packId}/${pictureId}`);
    }
    expect(seen.size).toBe(total);
    const first = dailyPicture('2026-10-01');
    const again = dailyPicture(dailyKey(new Date(Date.UTC(2026, 9, 1 + total))));
    expect(again).toEqual(first);
  });
});
