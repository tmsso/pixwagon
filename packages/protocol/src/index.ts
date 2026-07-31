/**
 * @pixwagon/protocol — the WebSocket message contract (architecture.md §6).
 *
 * Why this is its own package rather than living in game-core: game-core is
 * specified as pure rules with no knowledge of transport (§4A). Wire formats are
 * transport. Putting them together would mean the rules engine could never be
 * reasoned about independently of how bytes travel.
 *
 * Why zod and not bare TypeScript types: the server is the referee (§2.3), and a
 * referee that trusts `JSON.parse` has no idea what it just accepted. Inbound
 * messages are *validated*, not asserted. Types are inferred from the schemas so
 * there is exactly one definition of each message.
 */

import { z } from 'zod';

/**
 * Bumped on any breaking change to the messages below. The client sends it on
 * join; a server seeing a version it does not speak refuses the connection with
 * a clear error rather than half-working.
 */
export const PROTOCOL_VERSION = 1;

// ---------------------------------------------------------------------------
// Shared fragments
// ---------------------------------------------------------------------------

export const roomCodeSchema = z
  .string()
  .regex(/^[A-Z0-9]{4,8}$/, 'room codes are 4-8 uppercase letters/digits');

export const displayNameSchema = z.string().trim().min(1).max(24);

export const cellRefSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
});

export const gameModeSchema = z.enum(['same-board', 'own-board', 'solo', 'daily']);

/**
 * A piece's orientation at placement time (docs/mechanics-correction.md):
 * rotation and mirroring are the player's free choice, not fixed by the offer.
 * `pieceId` is validated as a non-empty string, not a strict enum of the 9
 * shape-library ids — protocol validates shape, game-core validates whether
 * this specific id is a real piece (`applyMove`'s `unknown-piece` rejection),
 * the same split already used for `comboId` before this rewrite.
 */
export const orientationSchema = z.object({
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  mirrored: z.boolean(),
});

export const piecePlacementSchema = z.object({
  pieceId: z.string().min(1),
  orientation: orientationSchema,
  origin: cellRefSchema,
});

/**
 * Atomic pair placement means one message carries both piece placements. A
 * fallback move carries one blob per size its face requires — at most 2 blobs
 * (compound faces), each at most 3 cells (the largest single blob, in the
 * `3` and `1+3` faces) — both-blobs-or-neither for a compound face is a
 * game-core legality rule (`incomplete-compound-choice`), not a wire shape.
 */
export const moveChoiceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('pair'),
    placements: z.tuple([piecePlacementSchema, piecePlacementSchema]),
  }),
  z.object({
    kind: z.literal('fallback'),
    blobs: z.array(z.array(cellRefSchema).min(1).max(3)).min(1).max(2),
  }),
]);

// ---------------------------------------------------------------------------
// Client → server
// ---------------------------------------------------------------------------

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('join'),
    protocolVersion: z.number().int().positive(),
    name: displayNameSchema,
  }),
  z.object({ type: z.literal('leave') }),
  /** Ask the referee to issue the next round's roll. */
  z.object({ type: z.literal('request-roll') }),
  /**
   * Intent, never result (§5). The client says what it wants to fill; the server
   * decides whether it happened.
   */
  z.object({
    type: z.literal('fill'),
    round: z.number().int().nonnegative(),
    choice: moveChoiceSchema,
  }),
  z.object({ type: z.literal('rematch') }),
  /** Liveness. Kept explicit so hibernation behaviour is testable. */
  z.object({ type: z.literal('ping'), t: z.number() }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

// ---------------------------------------------------------------------------
// Server → client
// ---------------------------------------------------------------------------

export const serverErrorCodeSchema = z.enum([
  'protocol-version-mismatch',
  'room-full',
  'bad-message',
  'not-joined',
  'move-rejected',
  'internal',
]);

/**
 * Server messages are typed but not zod-validated on the client: the client
 * already trusts the server (it is the authority), and validating truth you
 * cannot override buys nothing. Schemas exist here anyway so tests can build
 * well-formed fixtures.
 */
export const serverMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('welcome'),
    protocolVersion: z.number().int().positive(),
    playerId: z.string(),
    code: roomCodeSchema,
  }),
  /** Full snapshot. Sent on join and after any resync. */
  z.object({ type: z.literal('state'), state: z.unknown() }),
  /** Incremental truth. The common case once a room is running. */
  z.object({ type: z.literal('delta'), delta: z.unknown() }),
  z.object({ type: z.literal('presence'), players: z.array(z.unknown()) }),
  z.object({ type: z.literal('roll'), roll: z.unknown() }),
  z.object({
    type: z.literal('fill-accepted'),
    playerId: z.string(),
    round: z.number().int().nonnegative(),
    cells: z.array(cellRefSchema),
  }),
  /** Triggers the client's optimistic-fill rollback. */
  z.object({
    type: z.literal('fill-rejected'),
    round: z.number().int().nonnegative(),
    reason: z.string(),
    cells: z.array(cellRefSchema),
  }),
  z.object({ type: z.literal('round-result'), result: z.unknown() }),
  z.object({ type: z.literal('pong'), t: z.number() }),
  z.object({ type: z.literal('error'), code: serverErrorCodeSchema, message: z.string() }),
]);

export type ServerMessage = z.infer<typeof serverMessageSchema>;

// ---------------------------------------------------------------------------
// Encode / decode
// ---------------------------------------------------------------------------

export type DecodeResult<T> = { ok: true; message: T } | { ok: false; error: string };

/** Safe inbound decode for the server. Never throws on hostile input. */
export function decodeClientMessage(raw: string | ArrayBuffer): DecodeResult<ClientMessage> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw));
  } catch {
    return { ok: false, error: 'not valid JSON' };
  }

  const result = clientMessageSchema.safeParse(parsed);
  if (!result.success) {
    const first = result.error.issues[0];
    return {
      ok: false,
      error: first ? `${first.path.join('.') || 'message'}: ${first.message}` : 'invalid message',
    };
  }
  return { ok: true, message: result.data };
}

export function encode(message: ServerMessage | ClientMessage): string {
  return JSON.stringify(message);
}
