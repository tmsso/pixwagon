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
          <PlayerChip name="Tamas" colorIndex={0} score={0} active />
          <PlayerChip name="Guest" colorIndex={1} score={0} />
        </>
      }
      controls={
        <RollControl
          dice={[
            { sides: 6, value: 4 },
            { sides: 6, value: 2 },
          ]}
          options={[
            { id: 'a', label: 'Fill', cells: 4 },
            { id: 'b', label: 'Fill', cells: 2 },
          ]}
          selectedOptionId="a"
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
