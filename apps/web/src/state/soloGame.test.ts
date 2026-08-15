import { describe, expect, it } from 'vitest';
import { createBoard, issueRoll } from '@pixwagon/game-core';
import { initialSoloConfig, useSoloGameStore } from './soloGame.ts';

describe('initialSoloConfig', () => {
  it('defaults to the transportation pack, tram picture, and a fresh seed', () => {
    const config = initialSoloConfig('');
    expect(config.packId).toBe('transportation');
    expect(config.pictureId).toBe('tram');
    expect(config.roomSeed).toMatch(/^solo-/);
  });

  it('honours a ?seed= override, for reproducible verification', () => {
    const config = initialSoloConfig('?seed=achievability-0');
    expect(config.roomSeed).toBe('achievability-0');
  });
});

describe('useSoloGameStore', () => {
  it('derives board and roll from game-core the same way the engine would', () => {
    useSoloGameStore
      .getState()
      .start({ roomSeed: 'test-seed', packId: 'transportation', pictureId: 'tram' });
    const state = useSoloGameStore.getState();

    expect(state.board).toEqual(createBoard('transportation', 'tram'));
    expect(state.roll).toEqual(issueRoll('test-seed', 1));
    expect(state.round).toBe(1);
  });

  it('start() replaces the whole session, not just part of it', () => {
    useSoloGameStore
      .getState()
      .start({ roomSeed: 'seed-a', packId: 'transportation', pictureId: 'tram' });
    useSoloGameStore
      .getState()
      .start({ roomSeed: 'seed-b', packId: 'transportation', pictureId: 'sailboat' });

    const state = useSoloGameStore.getState();
    expect(state.roomSeed).toBe('seed-b');
    expect(state.pictureId).toBe('sailboat');
    expect(state.board).toEqual(createBoard('transportation', 'sailboat'));
  });
});
