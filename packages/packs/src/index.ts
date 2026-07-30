/**
 * @pixwagon/packs — shape-pack schema and the shipped pack data.
 *
 * Read by BOTH the client (to render) and the room Durable Object (to validate),
 * exactly like game-core. Same reason: if the two sides disagreed about what a
 * picture's fillable cells are, the referee would reject legal moves.
 */

import transportationJson from '../data/transportation.json' with { type: 'json' };
import { parsePack, type Pack } from './schema.js';

export * from './schema.js';

/**
 * Parsed at module load, deliberately. A malformed pack should crash at startup
 * with a readable message, not halfway through someone's game.
 */
export const transportation: Pack = parsePack(transportationJson);

export const packs: readonly Pack[] = [transportation];

export function getPack(id: string): Pack | undefined {
  return packs.find((pack) => pack.id === id);
}
