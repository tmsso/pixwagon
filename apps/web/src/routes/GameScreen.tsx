import { useParams } from 'react-router';
import { BoardCanvas } from '../components/game/BoardCanvas.tsx';
import { HudFrame } from '../components/game/HudFrame.tsx';
import { PlayerChip } from '../components/game/PlayerChip.tsx';
import { RollControl } from '../components/game/RollControl.tsx';
import { fallbackFaceView, pieceOfferView } from '../state/offerView.ts';
import { useSoloGameStore } from '../state/soloGame.ts';

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

  return (
    <HudFrame
      roomCode={code?.toUpperCase() ?? 'SOLO'}
      round={round}
      players={
        <>
          <PlayerChip name="You" colorIndex={0} score={0} active />
        </>
      }
      controls={
        <RollControl
          pair={[pieceOfferView(roll.pair[0]), pieceOfferView(roll.pair[1])]}
          fallbackFace={fallbackFaceView(roll.fallback)}
        />
      }
    >
      <BoardCanvas board={board} cellSize={20} />
    </HudFrame>
  );
}
