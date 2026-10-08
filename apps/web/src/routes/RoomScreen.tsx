import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';
import type { CellRef, PieceId } from '@pixwagon/game-core';
import { MAX_PLAYERS, SKIP_WAITING_AFTER_MS } from '@pixwagon/protocol';
import type { RoomSnapshot } from '@pixwagon/protocol';
import { getPack } from '@pixwagon/packs';
import { BoardCanvas } from '../components/game/BoardCanvas.tsx';
import { HudFrame } from '../components/game/HudFrame.tsx';
import { PlacementEditor } from '../components/game/PlacementEditor.tsx';
import { PlayerChip } from '../components/game/PlayerChip.tsx';
import { RollControl } from '../components/game/RollControl.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Panel } from '../components/ui/Panel.tsx';
import { useBoardCellSize } from '../design/boardScale.ts';
import { roomSocketUrl } from '../net/roomOrigin.ts';
import { loadDisplayName, normaliseName, saveDisplayName } from '../state/displayName.ts';
import { fallbackHasLegalPlacement, pairHasLegalPlacement } from '../state/legality.ts';
import { fallbackFaceView, pieceOfferView } from '../state/offerView.ts';
import {
  activeCandidateCells,
  candidateCells,
  isPendingComplete,
  pendingCellCount,
} from '../state/placement.ts';
import { myBoard, useRoomGameStore } from '../state/roomGame.ts';
import type { RoomPlayerIdentity } from '../state/roomGame.ts';
import {
  canSkipWaiting,
  connectionPill,
  roomPhase,
  roomRanking,
  startBlockedReason,
  waitingLine,
  waitingStatus,
} from '../state/roomView.ts';
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
    case 'ended':
      return <RoomEnded snapshot={snapshot!} />;
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
          : // `registerType: 'prompt'` (vite.config.ts): a reload alone keeps
            // serving the old build until the update banner is accepted.
            'This room runs a newer version of Pixwagon. Go back to the start and accept the update when it’s offered.'}
      </p>
      <Link to={reason === 'room-full' ? '/lobby' : '/'} className="text-accent underline">
        {reason === 'room-full' ? 'Back to the lobby' : 'Back to the start'}
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
            // Away players keep their seat and squares (protocol 2); the
            // chip dims and says "away" rather than vanishing (pass 02 `12c`).
            connected={player.connected}
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

/** The local clock, refreshed once when `at` (ms) passes — for UI that
 *  appears after a delay, like the host's skip button, without a ticking
 *  interval. The state update happens in the timer callback, never during
 *  render or synchronously in the effect. */
function useNowAfter(at: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (at === null) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, at - Date.now()));
    return () => clearTimeout(timer);
  }, [at]);
  return now;
}

/**
 * The networked game (Phase 5 item 3; pass 02 `12a`–`12c`, `03f`). The same
 * turn flow as solo's `GameScreen` — offers, then the `PlacementEditor`
 * sheet — over this player's own board from the snapshot (D1(a): everyone
 * has a copy of one picture). A committed choice shows as `candidate` cells
 * until the referee rules (`fill-accepted` / `fill-rejected`); the sheet's
 * offers stay dimmed meanwhile.
 */
function RoomGame({ snapshot }: { snapshot: RoomSnapshot }) {
  const me = useRoomGameStore((state) => state.me);
  const connection = useRoomGameStore((state) => state.connection);
  const pending = useRoomGameStore((state) => state.pending);
  const prediction = useRoomGameStore((state) => state.prediction);
  const passPending = useRoomGameStore((state) => state.passPending);
  const lastRejection = useRoomGameStore((state) => state.lastRejection);
  const roundSeenAt = useRoomGameStore((state) => state.roundSeenAt);
  const store = useRoomGameStore.getState();
  const now = useNowAfter(roundSeenAt === null ? null : roundSeenAt + SKIP_WAITING_AFTER_MS);

  const board = myBoard(snapshot, me);
  const cellSize = useBoardCellSize(board?.size.width ?? 1);
  const roll = snapshot.currentRoll!;
  // The server issued these through game-core's `issueRoll`, so the wire
  // strings are real piece ids; the brand is a compile-time tag.
  const pair = [roll.pair[0] as PieceId, roll.pair[1] as PieceId] as const;

  if (!board) {
    // A joiner's board arrives in the `state` that follows `welcome`.
    return (
      <main className="grid min-h-dvh place-items-center bg-bg p-6 text-center">
        <p className="text-ink-muted" role="status">
          Getting your board…
        </p>
      </main>
    );
  }

  const acted = me !== null && snapshot.acted.includes(me.playerId);
  const awaitingServer = prediction !== null || passPending;
  const done = board.cells.every((cell) => cell !== 'fillable');
  const canAct = !acted && !awaitingServer && !done && connection === 'online';
  // Same pass rule as solo (owner decision 2026-10-08): only with no legal
  // move. The server would accept a pass any time; this is a client choice.
  const canPass =
    canAct &&
    !pending &&
    !pairHasLegalPlacement(board, pair) &&
    !fallbackHasLegalPlacement(board, roll.fallback);
  const waiting = waitingLine(snapshot, me?.playerId ?? null);
  const showSkip = canSkipWaiting(snapshot, me, roundSeenAt, now);

  function handleCellPress(cell: CellRef) {
    // `pending` only exists while this player can act (`choose` checks).
    if (!pending) return;
    if (pending.kind === 'pair') store.placeActiveOrigin(cell);
    else store.toggleBlobCell(cell);
  }

  const pendingCount = pending ? pendingCellCount(pending) : 0;
  const overlay = pending ? candidateCells(pending) : (prediction?.cells ?? []);

  let status: string | null = null;
  if (done) status = 'Your picture is complete!';
  else if (awaitingServer) status = 'Checking with the room…';
  else if (acted) status = 'Done for this round.';

  return (
    <HudFrame
      roomCode={snapshot.code}
      // `roll.round` is 0-based on the wire (docs/contracts/rng.md).
      round={roll.round + 1}
      connection={connectionPill(connection)}
      players={<RoomPlayers snapshot={snapshot} me={me} inGame />}
      sheet={
        pending ? (
          <PlacementEditor
            pending={pending}
            commitLabel={`Place ${pendingCount} square${pendingCount === 1 ? '' : 's'}`}
            commitDisabled={!isPendingComplete(pending)}
            onSetActive={store.setActive}
            onRotate={store.rotateActive}
            onMirror={store.mirrorActive}
            onTakeBack={store.clearActive}
            onCancel={store.cancelChoice}
            onCommit={store.commit}
          />
        ) : undefined
      }
      controls={
        <div className="flex flex-col gap-3">
          <RollControl
            pair={[pieceOfferView(pair[0]), pieceOfferView(pair[1])]}
            fallbackFace={fallbackFaceView(roll.fallback)}
            onChoose={store.choose}
            // `03f`: offers dim while the referee rules on a sent fill/pass.
            awaitingServer={awaitingServer}
            disabled={!canAct}
          />
          {canPass ? (
            <Button variant="secondary" size="lg" onClick={store.pass}>
              Pass the round
            </Button>
          ) : null}
          {status ? (
            <p className="text-center text-sm font-medium text-ink" role="status">
              {status}
            </p>
          ) : null}
          {(acted || done) && waiting ? (
            <p className="text-center text-sm text-ink-muted">{waiting}</p>
          ) : null}
          {showSkip ? (
            <Button variant="secondary" size="lg" onClick={store.skipWaiting}>
              Skip waiting players
            </Button>
          ) : null}
          {lastRejection ? (
            // Never scolding, never "invalid move" (design pass 02, 03g; D1's
            // reworded copy — under per-player boards nobody "got there first").
            <p className="text-center text-sm text-ink-muted" role="alert">
              Those squares didn&rsquo;t fit — try another spot.
            </p>
          ) : null}
        </div>
      }
    >
      <BoardCanvas
        board={board}
        cellSize={cellSize}
        colorIndex={snapshot.players.find((p) => p.id === me?.playerId)?.seatIndex ?? 0}
        candidateCells={overlay}
        activeCandidateCells={pending ? activeCandidateCells(pending) : []}
        invalid={lastRejection !== null}
        onCellPress={handleCellPress}
      />
    </HudFrame>
  );
}

/**
 * The end of a session (Phase 5's Accept: everyone sees the same final
 * ranking). Deliberately minimal — ranked names, points, squares — computed
 * by `roomRanking` from the snapshot's boards. The full results screen,
 * board comparison and rematch are Phase 6 (owner decision 2026-10-08).
 */
function RoomEnded({ snapshot }: { snapshot: RoomSnapshot }) {
  const me = useRoomGameStore((state) => state.me);
  const ranking = roomRanking(snapshot);

  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-center gap-6 bg-bg p-6">
      <header className="text-center">
        <p className="text-sm text-ink-muted">
          Room <span className="font-mono tracking-widest">{snapshot.code}</span>
        </p>
        <h1 className="text-2xl font-semibold text-ink">Game over</h1>
      </header>
      <Panel title="Final ranking">
        <ol className="grid gap-2">
          {ranking.map((row) => (
            <li key={row.playerId} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-3">
                <span className="w-6 text-right font-mono text-ink-muted">{row.rank}.</span>
                <PlayerChip
                  name={row.playerId === me?.playerId ? `${row.name} (you)` : row.name}
                  colorIndex={row.seatIndex}
                  active={row.playerId === me?.playerId}
                />
              </span>
              <span className="text-right text-sm text-ink-muted">
                {row.complete ? (
                  <span className="font-medium text-ink">Complete · {row.points} pts</span>
                ) : (
                  `${row.filled} of ${row.total} squares`
                )}
              </span>
            </li>
          ))}
        </ol>
      </Panel>
      <Link to="/lobby" className="text-center text-accent underline">
        Back to the lobby
      </Link>
    </main>
  );
}
