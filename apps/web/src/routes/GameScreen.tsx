import { useParams } from 'react-router';
import { BoardCanvas } from '../components/game/BoardCanvas.tsx';
import { HudFrame } from '../components/game/HudFrame.tsx';
import { PlayerChip } from '../components/game/PlayerChip.tsx';
import { RollControl } from '../components/game/RollControl.tsx';

export function GameScreen() {
  const { code } = useParams();

  return (
    <HudFrame
      roomCode={code?.toUpperCase() ?? 'SOLO'}
      round={1}
      connection="online"
      players={
        <>
          <PlayerChip name="Alex" colorIndex={0} score={0} active />
          <PlayerChip name="Guest" colorIndex={1} score={0} />
        </>
      }
      controls={
        <RollControl
          pair={[
            {
              id: 'a',
              cells: [
                { x: 0, y: 0 },
                { x: 1, y: 0 },
                { x: 0, y: 1 },
                { x: 1, y: 1 },
              ],
            },
            {
              id: 'b',
              cells: [
                { x: 0, y: 0 },
                { x: 1, y: 0 },
              ],
            },
          ]}
          fallbackFace={[1, 2]}
          selectedChoice="pair"
        />
      }
    >
      <div className="grid gap-3 text-center">
        <BoardCanvas width={12} height={8} cellSize={20} />
        <p className="text-xs text-ink-muted">
          Placeholder board — gameplay lands in Phase 2, multiplayer in Phase 5.
        </p>
      </div>
    </HudFrame>
  );
}
