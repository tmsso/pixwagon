import { Link, useParams } from 'react-router';
import { scoreBoard } from '@pixwagon/game-core';
import type { CellRef } from '@pixwagon/game-core';
import { BoardCanvas } from '../components/game/BoardCanvas.tsx';
import { HudFrame } from '../components/game/HudFrame.tsx';
import { PlacementEditor } from '../components/game/PlacementEditor.tsx';
import { PlayerChip } from '../components/game/PlayerChip.tsx';
import { RollControl } from '../components/game/RollControl.tsx';
import { Button } from '../components/ui/Button.tsx';
import { fallbackHasLegalPlacement, pairHasLegalPlacement } from '../state/legality.ts';
import { fallbackFaceView, pieceOfferView } from '../state/offerView.ts';
import {
  SOLO_PLAYER_ID,
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

  // `exactOptionalPropertyTypes` means RollControl's optional props can't be
  // handed an explicit `undefined` — they must be omitted, not set to it.
  const rollControlExtra = pending
    ? {
        selectedChoice: pending.kind,
        commit: {
          label: `Place ${pendingCellCount(pending)} square${pendingCellCount(pending) === 1 ? '' : 's'}`,
          disabled: !isPendingComplete(pending),
          onCommit: commit,
          onCancel: cancelChoice,
        },
      }
    : { onChoose: choose };

  return (
    <HudFrame
      roomCode={code?.toUpperCase() ?? 'SOLO'}
      round={round + 1}
      players={
        <>
          <PlayerChip name="You" colorIndex={0} score={score.points} active />
        </>
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
              {...rollControlExtra}
            />
            {pending ? (
              <PlacementEditor
                pending={pending}
                onSetActive={setActive}
                onRotate={rotateActive}
                onMirror={mirrorActive}
                onClearActive={clearActive}
              />
            ) : null}
            {canPass ? (
              <Button variant="secondary" size="lg" onClick={passRound}>
                Pass the round
              </Button>
            ) : null}
            {lastRejection ? (
              <p className="text-center text-sm text-danger" role="alert">
                Rejected: {lastRejection}
              </p>
            ) : null}
          </div>
        )
      }
    >
      <BoardCanvas
        board={board}
        cellSize={20}
        candidateCells={pending ? candidateCells(pending) : []}
        invalid={lastRejection !== null}
        onCellPress={handleCellPress}
      />
    </HudFrame>
  );
}
