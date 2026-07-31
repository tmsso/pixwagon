# Contract: WebSocket message protocol

**Implemented by** `packages/protocol/src/index.ts` · **Locked by** `index.test.ts`

The client/server seam. `docs/architecture.md` §6 says nail it before either side is fleshed out.

## Transport

One WebSocket per active room. The client connects to `GET /api/room/:code/ws`; the Worker validates the code and forwards the upgrade to that room's Durable Object, which terminates the socket itself.

## Versioning

`PROTOCOL_VERSION` (currently `1`) is sent on `join`. A server that does not speak the version replies `error: protocol-version-mismatch` and closes with 1002 — rather than half-working, which is the failure mode that costs a day to diagnose.

## Direction and trust

**Client → server messages are validated with zod, not merely typed.** The server is the referee; a referee that trusts `JSON.parse` has no idea what it just accepted. `decodeClientMessage()` never throws on hostile input — it returns `{ ok: false, error }`.

Bounds are part of the contract, not an implementation detail: display names are trimmed and capped at 24 characters, a fallback blob carries at most 3 cells (a compound face's two blobs, at most), coordinates are non-negative integers. These reject at the seam so nothing malformed reaches the board. `pieceId` itself is validated only as a non-empty string here — whether it names a real piece is a game-core legality question (`unknown-piece`), not a wire-shape one.

**Server → client messages are typed but not validated on the client.** The client already trusts the server — it is the authority — and validating truth you cannot override buys nothing. Schemas exist anyway so tests can build well-formed fixtures.

## Messages

| Client → server | Meaning                                            |
| --------------- | -------------------------------------------------- |
| `join`          | `{ protocolVersion, name }` — the handshake        |
| `leave`         | Voluntary exit                                     |
| `request-roll`  | Ask the referee to issue the round's roll          |
| `fill`          | **Intent**: `{ round, choice }` — see below        |
| `rematch`       | Same players, fresh seed                           |
| `ping`          | Liveness; kept explicit so hibernation is testable |

| Server → client  | Meaning                                  |
| ---------------- | ---------------------------------------- |
| `welcome`        | `{ protocolVersion, playerId, code }`    |
| `state`          | Full snapshot — on join and after resync |
| `delta`          | Incremental truth; the common case       |
| `presence`       | Player list, derived from live sockets   |
| `roll`           | The issued roll                          |
| `fill-accepted`  | Confirms an optimistic fill              |
| `fill-rejected`  | Triggers client rollback                 |
| `round-result`   | Scores                                   |
| `pong` / `error` | Liveness / typed failure                 |

## The rule underneath it all

Clients submit **intent**; the server broadcasts **truth**. `fill` is a request, never a report. The client may paint the result immediately, but `fill-rejected` must visibly undo it — `BoardCell` carries an `invalid` state for exactly this.

## Hibernation constraint

Per-connection state lives in the socket **attachment** (`serializeAttachment`), never in a Durable Object instance field. The runtime may evict the object while sockets stay open; an instance field does not survive that. The room code itself is carried this way, because a DO cannot recover the name it was addressed by — the Worker passes it in an `X-Room-Code` header.

## Decided in Phase 1 (2026-08-01)

- **The `fill` message is rewritten** for the pair+fallback mechanic
  (`docs/mechanics-correction.md`): `{ round, choice }`, where `choice` is
  `{ kind: 'pair', placements: [PiecePlacement, PiecePlacement] }` (a fixed
  2-tuple — atomic placement means one message carries both) or
  `{ kind: 'fallback', blobs: CellRef[][] }` (1-2 blobs, each 1-3 cells). A
  `PiecePlacement` is `{ pieceId, orientation: { rotation, mirrored }, origin }`.
  `pieceId` is validated only as a non-empty string; whether it names a real
  piece is game-core's job (`unknown-piece`), the same split `comboId` already
  had. `index.test.ts` locks the new shape.

## Not yet decided

- `state` and `delta` payloads are `z.unknown()` in Phase 0. Phase 4 types them once the room state settles — typing them now would be guessing.
- Whether `request-roll` is host-only or anyone-can. Phase 4.
