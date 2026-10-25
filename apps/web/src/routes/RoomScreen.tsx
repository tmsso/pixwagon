import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';
import type { CellRef, PieceId } from '@pixwagon/game-core';
import { MAX_PLAYERS, SKIP_WAITING_AFTER_MS } from '@pixwagon/protocol';
import type { RoomSnapshot } from '@pixwagon/protocol';
import { BoardCanvas } from '../components/game/BoardCanvas.tsx';
import { BoardCompare } from '../components/game/BoardCompare.tsx';
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
  boardCompletion,
  canSkipWaiting,
  connectionPill,
  pictureProgress,
  roomPhase,
  roomRanking,
  startBlockedReason,
  waitingLine,
  waitingStatus,
} from '../state/roomView.ts';
import { RoomSettings } from './RoomSettings.tsx';
import { CantJoin } from './room/CantJoin.tsx';
import type { CantJoinReason } from './room/CantJoin.tsx';
import { JoinGate } from './room/JoinGate.tsx';
import { JoiningBoard, JoiningRoom } from './room/Joining.tsx';

/**
 * A networked room at `/r/CODE` (ROADMAP.md Phase 4 item 4, design pass 02
 * Part C — provisional). One route, three surfaces picked by `roomPhase`:
 * joining → the waiting room (`02c`–`02e`) → the networked game (`12a`–`12c`).
 *
 * The socket opens in an effect, never during render: `scripts/check-screens`
 * server-renders this with a pre-seeded store, and a render that dialled out
 * would try to reach a worker from Node. Leaving the route leaves the room;
 * the rejoin token in `localStorage` makes coming back reclaim the seat.
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
    return <JoinGate code={code} name={name} onNameChange={setName} onSubmit={handleEnter} />;
  }

  switch (roomPhase(snapshot)) {
    case 'joining':
      return <JoiningRoom code={code} />;
    case 'waiting':
      return <WaitingRoom snapshot={snapshot!} />;
    case 'playing':
      return <RoomGame snapshot={snapshot!} />;
    case 'ended':
      return <RoomEnded snapshot={snapshot!} />;
  }
}

function RoomRefused({ code, reason }: { code: string; reason: string }) {
  const playHere = () => {
    const store = useRoomGameStore.getState();
    store.join(roomSocketUrl(code), code, store.name);
  };
  // `fatalError` is a server error code or the client's own `replaced`; only
  // `room-full` and `replaced` have screens of their own, and anything else
  // terminal is the version mismatch, as it was before pass 03.
  const known: CantJoinReason =
    reason === 'room-full' || reason === 'replaced' ? reason : 'protocol-version-mismatch';
  return <CantJoin code={code} reason={known} onPlayHere={playHere} />;
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
            // D9: mid-game, other players show how far along they are —
            // a number on the chip, never their board.
            {...(inGame && player.id !== me?.playerId
              ? completionProp(boardCompletion(snapshot, player.id))
              : {})}
          />
        ))}
    </>
  );
}

function completionProp(completion: number | null): { completion?: number } {
  return completion === null ? {} : { completion };
}

function WaitingRoom({ snapshot }: { snapshot: RoomSnapshot }) {
  const me = useRoomGameStore((state) => state.me);
  const connection = useRoomGameStore((state) => state.connection);
  const requestRoll = useRoomGameStore((state) => state.requestRoll);
  const [copied, setCopied] = useState(false);
  const blocked = startBlockedReason(snapshot, me);
  const status = waitingStatus(snapshot);

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

      <RoomSettings snapshot={snapshot} isHost={me?.isHost ?? false} />

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

  const progress = pictureProgress(snapshot);
  // Shared by the real game and its loading skeleton, so the header and the
  // chips are already in place when a mid-game joiner waits for their board.
  const hud = {
    roomCode: snapshot.code,
    // Counted within the picture in play (D8: a fresh budget per picture),
    // not the global 0-based `roll.round` (docs/contracts/rng.md).
    round: progress?.round ?? roll.round + 1,
    ...(progress?.rounds ? { roundOf: progress.rounds } : {}),
    ...(progress ? { picture: { index: progress.picture, count: progress.pictures } } : {}),
    connection: connectionPill(connection),
    players: <RoomPlayers snapshot={snapshot} me={me} inGame />,
  };

  // A joiner's board arrives in the `state` that follows `welcome` (pass 03 `12h`).
  if (!board) return <JoiningBoard hud={hud} />;

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

  const morePictures = progress !== null && progress.picture < progress.pictures;

  let status: string | null = null;
  if (done) {
    status = morePictures
      ? 'Your picture is complete! The room moves on when everyone is done.'
      : 'Your picture is complete!';
  } else if (awaitingServer) status = 'Checking with the room…';
  else if (acted) status = 'Done for this round.';
  else if (progress?.isNewPicture) {
    // D8: the whole room moved on together. Said on the new picture's first
    // round only; the finished one is kept for the results screen.
    status = `On to picture ${progress.picture} of ${progress.pictures} — your last one is kept for the results.`;
  }

  return (
    <HudFrame
      {...hud}
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
 * The room results screen (Phase 6; pass 02 `13a`–`13c`, provisional until
 * design pass 03). Ranked by completed pictures, then squares, from the
 * snapshot alone (`roomRanking`), so everyone — including someone who
 * reconnects after the end — sees the same ranking (Phase 5's Accept). Every
 * picture of the session is shown side by side in `BoardCompare`. The host
 * offers a rematch (D10): everyone returns to the waiting room, nobody
 * rejoins.
 */
function RoomEnded({ snapshot }: { snapshot: RoomSnapshot }) {
  const me = useRoomGameStore((state) => state.me);
  const rematch = useRoomGameStore((state) => state.rematch);
  const ranking = roomRanking(snapshot);
  const pictures = snapshot.stageCount ?? 1;

  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-center gap-6 bg-bg p-6">
      <header className="text-center">
        <p className="text-sm text-ink-muted">
          Room <span className="font-mono tracking-widest">{snapshot.code}</span>
        </p>
        <h1 className="text-2xl font-semibold text-ink">Game over</h1>
        <p className="text-sm text-ink-muted">
          {snapshot.mode === 'own-board' ? 'Own board' : 'Same board'} · {pictures} picture
          {pictures === 1 ? '' : 's'}
        </p>
      </header>
      <Panel title="Final ranking">
        <BoardCompare entries={ranking} {...(me ? { meId: me.playerId } : {})} />
      </Panel>
      <div className="grid gap-2 text-center">
        {me?.isHost ? (
          <Button size="lg" onClick={rematch}>
            Rematch
          </Button>
        ) : (
          <p className="text-sm text-ink-muted">The host can start a rematch for everyone here.</p>
        )}
        <Link to="/lobby" className="text-accent underline">
          Back to the lobby
        </Link>
      </div>
    </main>
  );
}
