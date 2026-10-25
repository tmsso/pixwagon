import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation } from 'react-router';
import type { CellRef, PieceId } from '@pixwagon/game-core';
import { SKIP_WAITING_AFTER_MS } from '@pixwagon/protocol';
import type { RoomSnapshot } from '@pixwagon/protocol';
import { BoardCanvas } from '../components/game/BoardCanvas.tsx';
import { getPack } from '@pixwagon/packs';
import { BoardCompare } from '../components/game/BoardCompare.tsx';
import { HudFrame } from '../components/game/HudFrame.tsx';
import { PictureStrip } from '../components/game/PictureStrip.tsx';
import { PlacementEditor } from '../components/game/PlacementEditor.tsx';
import { RollControl } from '../components/game/RollControl.tsx';
import { Button } from '../components/ui/Button.tsx';
import { ArrowIcon, RefreshIcon } from '../components/ui/icons.tsx';
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
import {
  canSkipWaiting,
  connectionPill,
  pictureProgress,
  roomPhase,
  roomRanking,
  joinNames,
  lastSquaresPhrase,
  boardOutcome,
  previousPicture,
  waitingLine,
  waitingNames,
} from '../state/roomView.ts';
import { CantJoin } from './room/CantJoin.tsx';
import type { CantJoinReason } from './room/CantJoin.tsx';
import { JoinGate } from './room/JoinGate.tsx';
import { JoiningBoard, JoiningRoom } from './room/Joining.tsx';
import { RoomPlayers } from './room/RoomPlayers.tsx';
import { WaitingRoom } from './room/WaitingRoom.tsx';

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

  // The Lobby marks a code the player typed (note 18 / Annotation 27).
  const arrivedByCode = (useLocation().state as { byCode?: boolean } | null)?.byCode === true;
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
      return <WaitingRoom snapshot={snapshot!} arrivedByCode={arrivedByCode} />;
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

/** What the finished-picture card says the room is waiting for (`12f`):
 *  which picture comes next, or that the results do. */
function doneLine(waitingFor: readonly string[], nextPicture: number | null): string {
  const who = waitingFor.length > 0 ? joinNames(waitingFor) : 'everyone';
  const be = waitingFor.length > 1 ? 'are' : 'is';
  return nextPicture !== null
    ? `Picture ${nextPicture} starts for everyone when ${who} ${be} done with this one.`
    : `${who} ${be} still placing. The results open when they're done.`;
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
  const skipped = useRoomGameStore((state) => state.skipped);
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

  const overlay = pending ? candidateCells(pending) : (prediction?.cells ?? []);

  const morePictures = progress !== null && progress.picture < progress.pictures;

  // Everything else the player needs to know is said by something with a
  // shape of its own: the held sheet and the line under the board while the
  // referee rules, the finished-picture card (`12f`) and the strip above a
  // new picture's board (`12i`).
  const status: string | null = acted && !done ? 'Done for this round.' : null;

  // The picture just played, reported until this player's first action on the
  // new one (note 9); and, once their own is complete, the card that replaces
  // the offers while the room waits (note 10).
  const lastPicture =
    progress?.isNewPicture && !acted && me ? previousPicture(snapshot, me.playerId) : null;
  const lastPictureData = lastPicture
    ? getPack(lastPicture.packId)?.pictures.find((p) => p.id === lastPicture.pictureId)
    : undefined;
  const nowPicture = getPack(board.packId)?.pictures.find((p) => p.id === board.pictureId);
  const outcome = done && me ? boardOutcome(me.playerId, board) : null;
  const waitingForOthers = waitingNames(snapshot, me?.playerId ?? null);

  // Who "Move on without …" names, and what happens to them (pass 03 note 4).
  const skipNames = showSkip ? waitingNames(snapshot, me?.playerId ?? null) : [];
  const ownBoard = snapshot.mode === 'own-board';
  // A sheet is up for the choice being composed, or — held and inert — for one
  // already sent, until the referee answers (note 5, `12g`).
  const sheetChoice = pending ?? prediction?.sheet ?? null;

  return (
    <HudFrame
      {...hud}
      sheet={
        sheetChoice ? (
          <PlacementEditor
            pending={sheetChoice}
            busy={pending === null}
            commitLabel={`Place ${pendingCellCount(sheetChoice)} square${pendingCellCount(sheetChoice) === 1 ? '' : 's'}`}
            commitDisabled={!isPendingComplete(sheetChoice)}
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
          {skipped && !acted && !done ? (
            // The host moved on without this player (`12e`, second frame).
            // Says so before anything else, or the board looks like it
            // skipped a round by itself.
            <p
              className="flex items-start gap-2 rounded-xl border border-border bg-surface p-3 text-sm text-ink"
              role="status"
            >
              <span className="mt-0.5 shrink-0 text-ink-muted">
                <ArrowIcon />
              </span>
              The room moved on to a new round. Your board is just as you left it.
            </p>
          ) : null}
          {lastRejection ? (
            // Never scolding, never "invalid move" (design pass 02, 03g; D1's
            // reworded copy — under per-player boards nobody "got there first").
            <p
              className="flex items-center gap-2 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-ink"
              role="alert"
            >
              <span className="shrink-0 text-danger">
                <RefreshIcon />
              </span>
              Those squares didn&rsquo;t fit — try another spot.
            </p>
          ) : null}
          {outcome && nowPicture ? (
            // `12f`: nothing left to place, so the offers give way to the
            // finished picture — and what the room is waiting for.
            <PictureStrip
              rows={nowPicture.rows}
              palette={nowPicture.palette}
              label={nowPicture.name}
              cellSize={6}
              eyebrow={
                morePictures
                  ? `Picture ${progress.picture} of ${progress.pictures} complete`
                  : 'Picture complete'
              }
              title={`${nowPicture.name} · ${outcome.points} points`}
            >
              {doneLine(waitingForOthers, morePictures ? progress.picture + 1 : null)}
            </PictureStrip>
          ) : (
            <>
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
            </>
          )}
          {connection === 'reconnecting' ? (
            // `12c`: the offers are disabled while the socket is down; say
            // that nothing is lost, so waiting doesn't feel like a failure.
            <div className="text-center" role="status">
              <p className="text-sm font-medium text-ink">Reconnecting…</p>
              <p className="text-sm text-ink-muted">
                Your board is safe. You can carry on the moment you&rsquo;re back.
              </p>
            </div>
          ) : status ? (
            <p className="text-center text-sm font-medium text-ink" role="status">
              {status}
            </p>
          ) : null}
          {acted && !done && waiting ? (
            <p className="text-center text-sm text-ink-muted">{waiting}</p>
          ) : null}
          {showSkip && skipNames.length > 0 ? (
            <div className="grid gap-1.5">
              <Button variant="secondary" size="lg" onClick={store.skipWaiting}>
                Move on without {joinNames(skipNames)}
              </Button>
              {/* Never "skip" or "kick": the host moves the room forward, and
                  the person isn't punished (Annotation 23). */}
              <p className="text-center text-xs text-ink-muted">
                {skipNames.length === 1
                  ? `${skipNames[0]} keeps their board and plays the next round.`
                  : `${joinNames(skipNames)} keep their boards and play the next round.`}{' '}
                Only you see this.
              </p>
            </div>
          ) : null}
        </div>
      }
    >
      <div className="grid justify-items-center gap-3">
        {lastPicture && lastPictureData ? (
          // `12i`: the picture just played, in its own colours, until the
          // first move on the new one.
          <div className="w-full max-w-sm">
            <PictureStrip
              rows={lastPictureData.rows}
              palette={lastPictureData.palette}
              label={lastPictureData.name}
              cellSize={5}
              eyebrow={`Picture ${(progress?.picture ?? 2) - 1} · ${lastPictureData.name}`}
              title={
                lastPicture.complete
                  ? `Complete · ${lastPicture.points} points`
                  : 'Unfinished · scores nothing'
              }
            >
              {lastPicture.complete
                ? null
                : `Nothing fitted ${lastSquaresPhrase(lastPicture.remaining)}.`}
            </PictureStrip>
          </div>
        ) : null}
        <BoardCanvas
          board={board}
          cellSize={cellSize}
          colorIndex={snapshot.players.find((p) => p.id === me?.playerId)?.seatIndex ?? 0}
          candidateCells={overlay}
          activeCandidateCells={pending ? activeCandidateCells(pending) : []}
          invalid={lastRejection !== null}
          onCellPress={handleCellPress}
        />
        {/* One line under the board, always there (empty when there is nothing
            to say), so what it says never moves the board. While the referee
            rules it is the wait — shown here because the footer is hidden
            while the sheet is held (`12g`); otherwise what to do now (`12b`,
            `12d`: own board says why the picture differs from the others'). */}
        <p className="min-h-5 text-center text-sm text-ink-muted" role="status">
          {awaitingServer ? (
            'Checking with the room…'
          ) : lastPicture && nowPicture ? (
            // The new picture, named, and what it gets (`12i`). Own board: the
            // budget is shared even though the pictures differ.
            <>
              <b className="font-semibold text-ink">{nowPicture.name}</b>
              {ownBoard
                ? ` — a fresh board. ${snapshot.roundBudget} rounds for everyone this picture.`
                : ` — a fresh board and ${snapshot.roundBudget} rounds.`}
            </>
          ) : canAct && !pending ? (
            ownBoard ? (
              'Your own picture — everyone gets the same offers.'
            ) : (
              <>
                Take <b className="font-semibold text-ink">the pair</b> or{' '}
                <b className="font-semibold text-ink">the single</b>.
              </>
            )
          ) : null}
        </p>
      </div>
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
