import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HISTORY_LIMIT, dailyResult, loadHistory, recordResult } from './history.ts';
import type { ResultEntry } from './history.ts';

const entry = (over: Partial<ResultEntry> = {}): ResultEntry => ({
  kind: 'solo',
  daily: null,
  packId: 'transportation',
  pictureId: 'tram',
  rounds: 20,
  completedAt: '2026-10-22T10:00:00.000Z',
  ...over,
});

describe('local results history (Phase 7b)', () => {
  const stored = new Map<string, string>();

  beforeEach(() => {
    stored.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => void stored.set(key, value),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('keeps results newest first, across a reload (a fresh read of storage)', () => {
    recordResult(entry({ completedAt: 'a' }));
    recordResult(entry({ completedAt: 'b', kind: 'daily', daily: '2026-10-22' }));
    expect(loadHistory().map((e) => e.completedAt)).toEqual(['b', 'a']);
    expect(dailyResult(loadHistory(), '2026-10-22')?.completedAt).toBe('b');
    expect(dailyResult(loadHistory(), '2026-10-23')).toBeNull();
  });

  it('counts a daily once: a second completion of the same date keeps the first', () => {
    recordResult(entry({ kind: 'daily', daily: '2026-10-22', rounds: 18 }));
    recordResult(entry({ kind: 'daily', daily: '2026-10-22', rounds: 12 }));
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0]!.rounds).toBe(18);
  });

  it(`caps at ${HISTORY_LIMIT}`, () => {
    for (let i = 0; i < HISTORY_LIMIT + 5; i += 1) recordResult(entry({ completedAt: String(i) }));
    expect(loadHistory()).toHaveLength(HISTORY_LIMIT);
    expect(loadHistory()[0]!.completedAt).toBe(String(HISTORY_LIMIT + 4));
  });

  it('drops corrupt storage instead of trusting it', () => {
    stored.set('pixwagon.history', 'not json');
    expect(loadHistory()).toEqual([]);
    stored.set('pixwagon.history', JSON.stringify([entry(), { kind: 'solo', rounds: 'many' }, 7]));
    expect(loadHistory()).toEqual([entry()]);
  });
});
