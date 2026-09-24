import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';
import { createBoard } from '@pixwagon/game-core';
import type { PieceId } from '@pixwagon/game-core';
import { MAX_PLAYERS } from '@pixwagon/protocol';
import type { RoomSnapshot } from '@pixwagon/protocol';
import { getPack } from '@pixwagon/packs';
import { BoardCanvas } from '../components/game/BoardCanvas.tsx';
import { HudFrame } from '../components/game/HudFrame.tsx';
import { PlayerChip } from '../components/game/PlayerChip.tsx';
import { RollControl } from '../components/game/RollControl.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Panel } from '../components/ui/Panel.tsx';
import { useBoardCellSize } from '../design/boardScale.ts';
import { roomSocketUrl } from '../net/roomOrigin.ts';
import { loadDisplayName, normaliseName, saveDisplayName } from '../state/displayName.ts';
import { fallbackFaceView, pieceOfferView } from '../state/offerView.ts';
import { useRoomGameStore } from '../state/roomGame.ts';
import type { RoomPlayerIdentity } from '../state/roomGame.ts';
import { connectionPill, roomPhase, startBlockedReason, waitingStatus } from '../state/roomView.ts';
import { NameField } from './NameField.tsx';

/**
 * A networked room at `/r/CODE` (ROADMAP.md Phase 4 item 4, design pass 02
 * Part C — provisional). One route, three surfaces picked by `roomPhase`:
 * joining → the waiting room (`02c`–`02e`) → the networked game (`12a`–`12c`).
 *
 * The socket opens in an effect, never during render: `scripts/check-screens`
 * server-renders this with a pre-seeded store, and a render that dialled out
 * would try to reach a worker from Node. Leaving the route leaves the room;
 * the rejoin token in `sessionStorage` makes coming back reclaim the seat.
 */
export function RoomScreen({ code }: { code: string }) {
  const joinedCode = useRoomGameStore((state) => state.code);
  const [name, setName] = useState(() => loadDisplayName() ?? '');
  // A shared link opened on a device with no saved name asks for one first;
  // one with a saved name (or a store already in this room) goes straight in.
  const [ready, setReady] = useState(() => loadDisplayName() !== null || joinedCode === code);

  useEffect(() => {
    if (!ready) return;
    const store = useRoomGameStore.getState();
    if (store.code !== code) store.join(roomSocketUrl(code), code, normaliseName(name));
    return () => useRoomGameStore.getState().leave();
    // `name` is deliberately not a dependency: it only changes before `ready`
    // (the gate), and a rename must not tear down a live connection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, ready]);

  const snapshot = useRoomGameStore((state) => state.snapshot);
  const fatalError = useRoomGameStore((state) => state.fatalError);

  if (fatalError) return <RoomRefused code={code} reason={fatalError} />;

  if (!ready) {
    const handleEnter = (event: FormEvent) => {
      event.preventDefault();
      saveDisplayName(normaliseName(name));
      setReady(true);
    };
    return (
      <main className="mx-auto grid min-h-dvh max-w-md content-center gap-6 bg-bg p-6">
        <h1 className="text-center text-2xl font-semibold text-ink">
          Joining room <span className="font-mono tracking-widest">{code}</span>
        </h1>
        <Panel>
          <form className="grid gap-4" onSubmit={handleEnter}>
            <NameField value={name} onChange={setName} />
            <Button type="submit" size="lg">
              Join room
            </Button>
          </form>
        </Panel>
      </main>
    );
  }

  switch (roomPhase(snapshot)) {
    case 'joining':
      return (
        <main className="grid min-h-dvh place-items-center bg-bg p-6 text-center">
          <p className="text-ink-muted" role="status">
            Joining room <span className="font-mono tracking-widest text-ink">{code}</span>…
          </p>
        </main>
      );
    case 'waiting':
      return <WaitingRoom snapshot={snapshot!} />;
    case 'playing':
      return <RoomGame snapshot={snapshot!} />;
  }
}

function RoomRefused({ code, reason }: { code: string; reason: string }) {
  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-center gap-4 bg-bg p-6 text-center">
      <h1 className="text-xl font-semibold text-ink">
        Can&rsquo;t join <span className="font-mono tracking-widest">{code}</span>
      </h1>
      <p className="text-ink-muted">
        {reason === 'room-full'
          ? 'Room is full — six is the most we can tell apart on a board.'
          : 'This room runs a newer version of Pixwagon. Reload the page to update.'}
      </p>
      <Link to="/lobby" className="text-accent underline">
        Back to the lobby
      </Link>
    </main>
  );
}

function RoomPlayers({
  snapshot,
  me,
  inGame,
}: {
  snapshot: RoomSnapshot;
  me: RoomPlayerIdentity | null;
  inGame: boolean;
}) {
  return (
    <>
      {/* Seat order, not arrival order: the server lists live sockets in
          whatever order the runtime returns them, and chips reshuffling on
          every reconnect would make "who is who" harder, not easier. */}
      {[...snapshot.players]
        .sort((x, y) => x.seatIndex - y.seatIndex)
        .map((player) => (
          <PlayerChip
            key={player.id}
            // In-game the design names yourself "You" (`12a`); in the waiting
            // room everyone sees the same names (`02c`–`02e`).
            name={inGame && player.id === me?.playerId ? 'You' : player.name}
            colorIndex={player.seatIndex}
            host={!inGame && player.isHost}
            active={player.id === me?.playerId}
          />
        ))}
    </>
  );
}

function WaitingRoom({ snapshot }: { snapshot: RoomSnapshot }) {
  const me = useRoomGameStore((state) => state.me);
  const connection = useRoomGameStore((state) => state.connection);
  const requestRoll = useRoomGameStore((state) => state.requestRoll);
  const [copied, setCopied] = useState(false);
  const blocked = startBlockedReason(snapshot, me);
  const status = waitingStatus(snapshot);
  const pack = getPack('transportation');

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/r/${snapshot.code}`);
      setCopied(true);
    } catch {
      // Clipboard needs a secure context and permission; the code on screen
      // is the fallback, which is why it is the biggest thing on the page.
    }
  }

  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-center gap-6 bg-bg p-6">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ink-muted">Room code</p>
          <p className="font-mono text-4xl font-bold tracking-widest text-ink">{snapshot.code}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={copyLink}>
          {copied ? 'Link copied' : 'Copy link'}
        </Button>
      </header>

      <Panel title={`Players · ${snapshot.players.length} of ${MAX_PLAYERS}`}>
        <div className="flex flex-wrap gap-2">
          <RoomPlayers snapshot={snapshot} me={me} inGame={false} />
        </div>
        {status ? <p className="mt-3 text-sm text-ink-muted">{status}</p> : null}
      </Panel>

      {/* Mode and pack are fixed until Phase 6 adds own-board mode and more
          than one pack; shown so the room says what it will play. */}
      <Panel title="Boards" tone="sunken">
        <p className="font-medium">Same board</p>
        <p className="text-sm text-ink-muted">
          Everyone fills the same picture from the same offers.
          {pack ? ` ${pack.name} · ${pack.pictures.length} pictures.` : ''}
        </p>
      </Panel>

      <div className="grid gap-2 text-center">
        <Button size="lg" disabled={blocked !== null} onClick={requestRoll}>
          Start round
        </Button>
        {blocked ? <p className="text-sm text-ink-muted">{blocked}</p> : null}
        {connection === 'reconnecting' ? (
          <p className="text-sm text-ink-muted" role="status">
            Reconnecting…
          </p>
        ) : null}
      </div>
    </main>
  );
}

function RoomGame({ snapshot }: { snapshot: RoomSnapshot }) {
  const me = useRoomGameStore((state) => state.me);
  const connection = useRoomGameStore((state) => state.connection);
  const lastError = useRoomGameStore((state) => state.lastError);
  const requestRoll = useRoomGameStore((state) => state.requestRoll);
  // Provisional: the server holds no board or picture until Phase 5 item 1,
  // so this shows the picture solo plays, empty. Phase 5 replaces it with the
  // room's `pictureId` and this player's own board from the snapshot.
  const board = useMemo(() => createBoard('transportation', 'tram'), []);
  const cellSize = useBoardCellSize(board.size.width);
  const roll = snapshot.currentRoll!;

  return (
    <HudFrame
      roomCode={snapshot.code}
      // `roll.round` is 0-based on the wire (docs/contracts/rng.md).
      round={roll.round + 1}
      connection={connectionPill(connection)}
      players={<RoomPlayers snapshot={snapshot} me={me} inGame />}
      controls={
        <div className="flex flex-col gap-3">
          <RollControl
            // The server issued these through game-core's `issueRoll`, so the
            // wire strings are real piece ids; the brand is a compile-time tag.
            pair={[
              pieceOfferView(roll.pair[0] as PieceId),
              pieceOfferView(roll.pair[1] as PieceId),
            ]}
            fallbackFace={fallbackFaceView(roll.fallback)}
            disabled
          />
          <p className="text-center text-sm text-ink-muted">
            Placing pieces arrives with the next update.
          </p>
          {me?.isHost ? (
            <Button variant="secondary" size="lg" onClick={requestRoll}>
              Next round
            </Button>
          ) : (
            <p className="text-center text-sm text-ink-muted">The host deals the next round.</p>
          )}
          {lastError ? (
            <p className="text-center text-sm text-ink-muted" role="alert">
              {lastError}
            </p>
          ) : null}
        </div>
      }
    >
      <BoardCanvas board={board} cellSize={cellSize} />
    </HudFrame>
  );
}
