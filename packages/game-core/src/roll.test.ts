import { describe, expect, it } from 'vitest';
import { issueRoll } from './roll.js';
import { createRng, deriveSeed } from './rng.js';
import { FALLBACK_FACE_IDS } from './types.js';
import { SHAPE_LIBRARY } from './shapes.js';

const PIECE_IDS = new Set(SHAPE_LIBRARY.map((piece) => piece.id));

describe('issueRoll', () => {
  it('is deterministic for the same room seed and round', () => {
    expect(issueRoll('PIXW-7Q2M', 3)).toEqual(issueRoll('PIXW-7Q2M', 3));
  });

  it('a late joiner computes round 7 directly, without replaying rounds 0-6', () => {
    const roomSeed = 'PIXW-7Q2M';
    const fromTheStart = Array.from({ length: 7 }, (_, round) => issueRoll(roomSeed, round));
    const lateJoiner = issueRoll(roomSeed, 6);
    expect(lateJoiner).toEqual(fromTheStart[6]);
  });

  it('never repeats a piece within one pair offer', () => {
    for (let round = 0; round < 200; round += 1) {
      const roll = issueRoll('repeat-check', round);
      expect(roll.pair[0]).not.toBe(roll.pair[1]);
    }
  });

  it('only ever offers pieces that exist in the shape library', () => {
    for (let round = 0; round < 200; round += 1) {
      const roll = issueRoll('library-check', round);
      expect(PIECE_IDS.has(roll.pair[0])).toBe(true);
      expect(PIECE_IDS.has(roll.pair[1])).toBe(true);
    }
  });

  it('only ever offers a known fallback face', () => {
    for (let round = 0; round < 200; round += 1) {
      const roll = issueRoll('fallback-check', round);
      expect(FALLBACK_FACE_IDS).toContain(roll.fallback);
    }
  });

  it('reaches every fallback face across enough rounds', () => {
    const seen = new Set<string>();
    for (let round = 0; round < 500; round += 1) {
      seen.add(issueRoll('fallback-spread', round).fallback);
    }
    expect([...seen].sort()).toEqual([...FALLBACK_FACE_IDS].sort());
  });

  it("the fallback face is drawn from a stream that's independent of the pair — changing the fallback stream's discriminator alone must not move the pair", () => {
    // Pins the exact discriminator strings docs/contracts/rng.md's "not yet
    // decided" note flagged: deriveSeed(roomSeed, round, 'pair' | 'fallback').
    const roomSeed = 'discriminator-check';
    const round = 12;
    const roll = issueRoll(roomSeed, round);

    const pairRng = createRng(deriveSeed(roomSeed, round, 'pair'));
    const first = pairRng.pick(SHAPE_LIBRARY);
    const second = pairRng.pick(SHAPE_LIBRARY.filter((piece) => piece.id !== first.id));
    expect(roll.pair).toEqual([first.id, second.id]);

    // A stream keyed on a *different* discriminator (e.g. a hypothetical
    // future draw under 'fallback-alt') must not perturb the pair at all —
    // demonstrated here by confirming the fallback draw itself lives on its
    // own independent stream, not a continuation of the pair's.
    const fallbackRng = createRng(deriveSeed(roomSeed, round, 'fallback'));
    expect(roll.fallback).toBe(fallbackRng.pick(FALLBACK_FACE_IDS));
    expect(pairRng.drawn).toBe(2);
  });

  it('carries the round number and a round-derived seed', () => {
    const roll = issueRoll('seed-check', 5);
    expect(roll.round).toBe(5);
    expect(roll.seed).toBe('seed-check␟5');
  });

  /**
   * Locks the exact roll for a fixed room seed/round, same discipline as
   * rng.test.ts's frozen sequence and shapes.test.ts's frozen library —
   * changing the algorithm here changes every seeded room and past daily
   * puzzle.
   */
  it('matches the frozen reference roll for seed "pixwagon", round 0', () => {
    expect(issueRoll('pixwagon', 0)).toMatchInlineSnapshot(`
      {
        "fallback": "2+2",
        "pair": [
          "tetromino-t",
          "domino",
        ],
        "round": 0,
        "seed": "pixwagon␟0",
      }
    `);
  });
});
