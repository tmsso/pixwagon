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

/**
 * The most players a room seats — one per visually distinguishable identity
 * (hue **and** hatch; the Okabe–Ito-derived `playerColors` in
 * apps/web/src/design/tokens.ts). This is the single definition both sides read:
 * apps/server imports it here (it cannot import the web palette), and apps/web
 * re-exports it from tokens.ts with a test pinning `playerColors.length` to it.
 * Lives in `protocol`, not `game-core`, because "how many seats" is a room fact,
 * not a rule (ROADMAP.md Phase 4; handoff-02 engineering note 5, whose literal
 * "use playerColors.length" can't work server-side).
 */
export const MAX_PLAYERS = 6;

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

export type GameMode = z.infer<typeof gameModeSchema>;

/**
 * The fallback die's six faces. game-core owns the canonical list
 * (`FALLBACK_FACE_IDS`, frozen by docs/mechanics-correction.md); this is a
 * hand-kept mirror so `protocol` stays free of a `game-core` dependency — the
 * wire format is meant to be reasoned about without the rules. `apps/server`
 * depends on both packages and carries a test asserting the two stay identical.
 */
export const fallbackFaceSchema = z.enum(['1', '2', '3', '1+2', '2+2', '1+3']);

/**
 * A round's issued offer, mirroring game-core's `Roll`. Piece ids are validated
 * as non-empty strings only — whether one names a real `SHAPE_LIBRARY` piece is
 * game-core's question, the same split `pieceId` already uses on `fill`.
 */
export const rollSchema = z.object({
  round: z.number().int().nonnegative(),
  seed: z.string().min(1),
  // `.readonly()` so game-core's `Roll` (whose `pair` is a `readonly` tuple of
  // branded `PieceId`s) assigns straight into this without a cast.
  pair: z.tuple([z.string().min(1), z.string().min(1)]).readonly(),
  fallback: fallbackFaceSchema,
});

/**
 * One seated player, as it appears in `presence` and in a room snapshot's
 * `players`. `seatIndex` is both the seat and the colour/hatch index
 * (`playerColor(seatIndex)`); `isHost` marks the one connection allowed to
 * issue rolls. A `connected` flag is deliberately absent until the
 * reconnect/resync half of Phase 4 lands — every entry here is a live socket.
 */
export const playerPresenceSchema = z.object({
  id: z.string().min(1),
  name: displayNameSchema,
  seatIndex: z
    .number()
    .int()
    .min(0)
    .max(MAX_PLAYERS - 1),
  isHost: z.boolean(),
});

export type PlayerPresence = z.infer<typeof playerPresenceSchema>;

/**
 * The full room state a client gets on `join` and after any resync — typed here
 * now that Phase 4 has settled what a room holds (the ws-protocol contract left
 * this `z.unknown()` in Phase 0 deliberately, "typing it now would be
 * guessing"). `currentRoll` is the round currently in play, or `null` before
 * the host has started — a late joiner reads it straight from here without
 * replaying earlier rounds (docs/contracts/rng.md).
 */
export const roomSnapshotSchema = z.object({
  code: roomCodeSchema,
  mode: gameModeSchema,
  round: z.number().int().nonnegative(),
  currentRoll: rollSchema.nullable(),
  hostId: z.string().nullable(),
  players: z.array(playerPresenceSchema),
});

export type RoomSnapshot = z.infer<typeof roomSnapshotSchema>;

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
  // `request-roll` is host-only (decided Phase 4): the host connection is the
  // single writer that advances the round, so every client sees the same roll
  // and issuance can't race between peers.
  'not-host',
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
  z.object({ type: z.literal('state'), state: roomSnapshotSchema }),
  /**
   * Incremental truth. Still `z.unknown()`: a delta is a change to board state,
   * which fills produce — and fills arrive in Phase 5. Typing it here would be
   * guessing at a shape the next phase defines. Presence and roll changes have
   * their own messages already.
   */
  z.object({ type: z.literal('delta'), delta: z.unknown() }),
  z.object({ type: z.literal('presence'), players: z.array(playerPresenceSchema) }),
  z.object({ type: z.literal('roll'), roll: rollSchema }),
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
