import { describe, expect, it } from 'vitest';
import { FALLBACK_BLOB_SIZES, createBoard, issueRoll, legalCellsFor } from '@pixwagon/game-core';
import type { Board, CellRef, Orientation } from '@pixwagon/game-core';
import { absolutePieceCells } from './legality.ts';
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
    // 0-indexed, matching issueRoll/Move.round's convention (docs/contracts/rng.md).
    expect(state.roll).toEqual(issueRoll('test-seed', 0));
    expect(state.round).toBe(0);
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

function cellKey(cell: CellRef): string {
  return `${cell.x},${cell.y}`;
}

/** Same free-search `findBlob` game-core's own achievability test uses
 *  (moves.test.ts) — any contiguous region of the right size, not a specific
 *  shape, so a local copy is simpler than exporting test-only logic. */
function findBlob(board: Board, size: number, avoid: Set<string>): CellRef[] | null {
  for (let y = 0; y < board.size.height; y += 1) {
    for (let x = 0; x < board.size.width; x += 1) {
      const key = cellKey({ x, y });
      if (board.cells[y * board.size.width + x] !== 'fillable' || avoid.has(key)) continue;

      const included: CellRef[] = [{ x, y }];
      const includedKeys = new Set([key]);
      while (included.length < size) {
        let grew = false;
        for (const cell of [...included]) {
          const neighbors: CellRef[] = [
            { x: cell.x + 1, y: cell.y },
            { x: cell.x - 1, y: cell.y },
            { x: cell.x, y: cell.y + 1 },
            { x: cell.x, y: cell.y - 1 },
          ];
          for (const neighbor of neighbors) {
            const nKey = cellKey(neighbor);
            if (includedKeys.has(nKey) || avoid.has(nKey)) continue;
            if (
              neighbor.x < 0 ||
              neighbor.y < 0 ||
              neighbor.x >= board.size.width ||
              neighbor.y >= board.size.height
            )
              continue;
            if (board.cells[neighbor.y * board.size.width + neighbor.x] !== 'fillable') continue;
            included.push(neighbor);
            includedKeys.add(nKey);
            grew = true;
            if (included.length === size) break;
          }
          if (included.length === size) break;
        }
        if (!grew) return null;
      }
      return included;
    }
  }
  return null;
}

function driveOrientation(target: Orientation) {
  const steps = target.rotation / 90;
  for (let i = 0; i < steps; i += 1) useSoloGameStore.getState().rotateActive();
  if (target.mirrored) useSoloGameStore.getState().mirrorActive();
}

describe('the store round loop, replayed against the Phase 1 achievability-0 witness', () => {
  it('reaches picture completion using only the public store actions a real UI would call', () => {
    // Same greedy strategy as game-core's own achievability test
    // (moves.test.ts), driven through choose/rotate/mirror/placeActiveOrigin/
    // toggleBlobCell/commit instead of calling applyMove directly — this is
    // the test that would have caught Phase 2 slice A shipping the store's
    // rounds 1-indexed while issueRoll/Move.round are 0-indexed (rng.md):
    // achievability-0 is only a proven witness for the 0-indexed sequence.
    useSoloGameStore
      .getState()
      .start({ roomSeed: 'achievability-0', packId: 'transportation', pictureId: 'tram' });

    const maxRounds = 100;
    for (let i = 0; i < maxRounds; i += 1) {
      const { board, roll, status } = useSoloGameStore.getState();
      if (status === 'complete') break;

      const [pieceA, pieceB] = roll.pair;
      const placementsA = legalCellsFor(board, pieceA);
      const placementsB = legalCellsFor(board, pieceB);

      let applied = false;
      outer: for (const pa of placementsA) {
        const cellsA = new Set(absolutePieceCells(pieceA, pa.orientation, pa.origin).map(cellKey));
        for (const pb of placementsB) {
          const cellsB = absolutePieceCells(pieceB, pb.orientation, pb.origin);
          if (cellsB.some((cell) => cellsA.has(cellKey(cell)))) continue;

          useSoloGameStore.getState().choose('pair');
          driveOrientation(pa.orientation);
          useSoloGameStore.getState().placeActiveOrigin(pa.origin);
          useSoloGameStore.getState().setActive(1);
          driveOrientation(pb.orientation);
          useSoloGameStore.getState().placeActiveOrigin(pb.origin);
          useSoloGameStore.getState().commit();
          applied = true;
          break outer;
        }
      }

      if (!applied) {
        const sizes = FALLBACK_BLOB_SIZES[roll.fallback];
        const avoid = new Set<string>();
        const blobs: CellRef[][] = [];
        for (const size of sizes) {
          const blob = findBlob(board, size, avoid);
          if (!blob) break;
          for (const cell of blob) avoid.add(cellKey(cell));
          blobs.push(blob);
        }
        if (blobs.length === sizes.length) {
          useSoloGameStore.getState().choose('fallback');
          blobs.forEach((blob, index) => {
            useSoloGameStore.getState().setActive(index);
            for (const cell of blob) useSoloGameStore.getState().toggleBlobCell(cell);
          });
          useSoloGameStore.getState().commit();
        } else {
          useSoloGameStore.getState().passRound();
        }
      }

      expect(useSoloGameStore.getState().lastRejection).toBeNull();
    }

    expect(useSoloGameStore.getState().status).toBe('complete');
  });
});
