import { Link, useParams } from 'react-router';
import { scoreBoard } from '@pixwagon/game-core';
import type { CellRef } from '@pixwagon/game-core';
import { BoardCanvas } from '../components/game/BoardCanvas.tsx';
import { HudFrame } from '../components/game/HudFrame.tsx';
import { PlacementEditor } from '../components/game/PlacementEditor.tsx';
import { PlayerChip } from '../components/game/PlayerChip.tsx';
import { RollControl } from '../components/game/RollControl.tsx';
import { Button } from '../components/ui/Button.tsx';
import { useBoardCellSize } from '../design/boardScale.ts';
import { fallbackHasLegalPlacement, pairHasLegalPlacement } from '../state/legality.ts';
import { fallbackFaceView, pieceOfferView } from '../state/offerView.ts';
import {
  SOLO_PLAYER_ID,
  activeCandidateCells,
  candidateCells,
  isPendingComplete,
  pendingCellCount,
  useSoloGameStore,
} from '../state/soloGame.ts';

/**
 * Solo-only for now (Phase 2) — same-board/own-board multiplayer wire into
 * this route in Phase 5/6 via `RoomState`, replacing `useSoloGameStore` with
 * server-pushed state. No `connection` pill: this route runs with no network
 * at all until then (docs/design/surfaces/ Annotation 08).
 *
 * Turn flow (design pass 02, Surface 03): the footer shows both offers →
 * picking one opens the `PlacementEditor` sheet over the board (offers collapse
 * into the sheet's chosen-offer bar) → compose → commit from inside the sheet.
 */
export function GameScreen() {
  const { code } = useParams();
  const board = useSoloGameStore((state) => state.board);
  const roll = useSoloGameStore((state) => state.roll);
  const round = useSoloGameStore((state) => state.round);
  const status = useSoloGameStore((state) => state.status);
  const pending = useSoloGameStore((state) => state.pending);
  const lastRejection = useSoloGameStore((state) => state.lastRejection);
  const choose = useSoloGameStore((state) => state.choose);
  const setActive = useSoloGameStore((state) => state.setActive);
  const rotateActive = useSoloGameStore((state) => state.rotateActive);
  const mirrorActive = useSoloGameStore((state) => state.mirrorActive);
  const placeActiveOrigin = useSoloGameStore((state) => state.placeActiveOrigin);
  const toggleBlobCell = useSoloGameStore((state) => state.toggleBlobCell);
  const clearActive = useSoloGameStore((state) => state.clearActive);
  const cancelChoice = useSoloGameStore((state) => state.cancelChoice);
  const commit = useSoloGameStore((state) => state.commit);
  const passRound = useSoloGameStore((state) => state.passRound);

  // Three integer steps, never a fraction (design pass 02, Annotation 11).
  const cellSize = useBoardCellSize(board.size.width);
  const score = scoreBoard(SOLO_PLAYER_ID, board);

  const canPass =
    !pending &&
    status === 'playing' &&
    !pairHasLegalPlacement(board, roll.pair) &&
    !fallbackHasLegalPlacement(board, roll.fallback);

  function handleCellPress(cell: CellRef) {
    if (!pending) return;
    if (pending.kind === 'pair') placeActiveOrigin(cell);
    else toggleBlobCell(cell);
  }

  const pendingCount = pending ? pendingCellCount(pending) : 0;

  return (
    <HudFrame
      roomCode={code?.toUpperCase() ?? 'SOLO'}
      round={round + 1}
      players={<PlayerChip name="You" colorIndex={0} score={score.points} active />}
      sheet={
        pending ? (
          <PlacementEditor
            pending={pending}
            commitLabel={`Place ${pendingCount} square${pendingCount === 1 ? '' : 's'}`}
            commitDisabled={!isPendingComplete(pending)}
            onSetActive={setActive}
            onRotate={rotateActive}
            onMirror={mirrorActive}
            onTakeBack={clearActive}
            onCancel={cancelChoice}
            onCommit={commit}
          />
        ) : undefined
      }
      controls={
        status === 'complete' ? (
          <div className="grid gap-3 text-center">
            <p className="text-sm font-medium text-ink" role="status">
              Picture complete! +{score.points} points
            </p>
            <Link to="/results">
              <Button size="lg" className="w-full">
                See results
              </Button>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <RollControl
              pair={[pieceOfferView(roll.pair[0]), pieceOfferView(roll.pair[1])]}
              fallbackFace={fallbackFaceView(roll.fallback)}
              onChoose={choose}
            />
            {canPass ? (
              <Button variant="secondary" size="lg" onClick={passRound}>
                Pass the round
              </Button>
            ) : null}
            {lastRejection ? (
              // Never scolding, never "invalid move" (design pass 02, 03g). Solo
              // has no other player to name, so this is the whole message.
              <p className="text-center text-sm text-ink-muted" role="alert">
                That didn&rsquo;t fit — those squares went back. Try another spot.
              </p>
            ) : null}
          </div>
        )
      }
    >
      <BoardCanvas
        board={board}
        cellSize={cellSize}
        candidateCells={pending ? candidateCells(pending) : []}
        activeCandidateCells={pending ? activeCandidateCells(pending) : []}
        invalid={lastRejection !== null}
        onCellPress={handleCellPress}
      />
    </HudFrame>
  );
}
