/**
 * @pixwagon/packs — shape-pack schema and the shipped pack data.
 *
 * Read by BOTH the client (to render) and the room Durable Object (to validate),
 * exactly like game-core. Same reason: if the two sides disagreed about what a
 * picture's fillable cells are, the referee would reject legal moves.
 */

import gardenJson from '../data/garden.json' with { type: 'json' };
import transportationJson from '../data/transportation.json' with { type: 'json' };
import { parsePack, type Pack } from './schema.js';

export * from './schema.js';

/**
 * Parsed at module load, deliberately. A malformed pack should crash at startup
 * with a readable message, not halfway through someone's game.
 */
export const transportation: Pack = parsePack(transportationJson);

/** Phase 8: the second pack, added as data plus this one registration. The
 *  `import` above is the seam's one known leak — Vite, wrangler's esbuild and
 *  tsx each need a static import per pack file, and JSON can't import JSON,
 *  so a `data/index.json` manifest could not remove it (2026-10-08). */
export const garden: Pack = parsePack(gardenJson);

export const packs: readonly Pack[] = [transportation, garden];

export function getPack(id: string): Pack | undefined {
  return packs.find((pack) => pack.id === id);
}
