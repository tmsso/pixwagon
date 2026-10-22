import { packs } from '@pixwagon/packs';
import type { SoloSessionConfig } from './soloGame.ts';

/**
 * The daily puzzle (ROADMAP.md Phase 7a): the same picture and the same
 * offers for everyone on a given UTC date, with no server at all. Everything
 * derives from the date. The seed is `daily-YYYY-MM-DD`, fed to the ordinary
 * solo store, and `issueRoll(seed, round)` makes round N identical on every
 * device (docs/contracts/rng.md). So the daily works offline and needs no
 * storage, which is why it was split from persistence (7b).
 *
 * UTC, not local time: two friends in different time zones should get the
 * same puzzle at the same moment. The day turns over at midnight UTC (1 or
 * 2 a.m. in Budapest).
 */

const DAY_MS = 86_400_000;

/** The UTC calendar date of `now`, as `YYYY-MM-DD`. */
export function dailyKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function dailySeed(key: string): string {
  return `daily-${key}`;
}

/**
 * The day's picture: a fixed rotation through every registered pack's
 * pictures, one per day. Deliberately not a seeded random pick: a rotation
 * never repeats a picture before every other one has had its day. Adding a
 * pack changes which picture a future date gets. That is harmless, because
 * no past daily is stored anywhere that would disagree.
 */
export function dailyPicture(key: string): { packId: string; pictureId: string } {
  const all = packs.flatMap((pack) =>
    pack.pictures.map((picture) => ({ packId: pack.id, pictureId: picture.id })),
  );
  const day = Math.floor(Date.parse(`${key}T00:00:00Z`) / DAY_MS);
  return all[((day % all.length) + all.length) % all.length]!;
}

/** Today's puzzle as a solo session. */
export function dailyConfig(now: Date = new Date()): SoloSessionConfig {
  const key = dailyKey(now);
  return { roomSeed: dailySeed(key), ...dailyPicture(key), daily: key };
}
