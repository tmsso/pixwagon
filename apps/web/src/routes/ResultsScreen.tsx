import { useNavigate } from 'react-router';
import { scoreBoard } from '@pixwagon/game-core';
import { getPack } from '@pixwagon/packs';
import { PicturePreview } from '../components/game/PicturePreview.tsx';
import { PlayerChip } from '../components/game/PlayerChip.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Panel } from '../components/ui/Panel.tsx';
import { SOLO_PLAYER_ID, freshSoloConfig, useSoloGameStore } from '../state/soloGame.ts';

/**
 * Solo results — `docs/design/surfaces/` Surface 05 is explicitly captioned
 * "solo completion", not a Phase 6 multiplayer comparison as the Phase 0
 * scaffold's `ScaffoldNotice` guessed before any design existed. Same
 * pattern as the Phase 2 "annotation 7" correction: the design handoff is
 * the later, more specific source ROADMAP.md Phase 2 says to build from.
 * Multiplayer's own ranked comparison is still Phase 6 — it reuses this
 * route but reads from `RoomState`, not `useSoloGameStore`.
 */
export function ResultsScreen() {
  const navigate = useNavigate();
  const board = useSoloGameStore((state) => state.board);
  const packId = useSoloGameStore((state) => state.packId);
  const pictureId = useSoloGameStore((state) => state.pictureId);
  const round = useSoloGameStore((state) => state.round);
  const status = useSoloGameStore((state) => state.status);
  const start = useSoloGameStore((state) => state.start);

  const picture = getPack(packId)?.pictures.find((candidate) => candidate.id === pictureId);
  const score = scoreBoard(SOLO_PLAYER_ID, board);

  function handleRematch() {
    start(freshSoloConfig());
    navigate('/r/solo');
  }

  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-center gap-6 bg-bg p-6">
      <div className="grid gap-1 text-center">
        <span className="text-xs uppercase tracking-wide text-ink-muted">
          {status === 'complete' ? 'Picture complete' : 'Still in progress'}
        </span>
        <h1 className="text-2xl font-semibold text-ink">{picture?.name ?? 'Picture'}</h1>
      </div>

      {picture ? (
        <Panel>
          <div className="grid place-items-center">
            <PicturePreview
              rows={picture.rows}
              palette={picture.palette}
              cellSize={12}
              label={picture.name}
            />
          </div>
        </Panel>
      ) : null}

      <Panel title="Score" tone="sunken">
        <div className="grid gap-2">
          <PlayerChip name="You" colorIndex={0} score={score.points} />
        </div>
        <p className="mt-2 text-xs text-ink-muted">
          {status === 'complete'
            ? `Completed in ${round + 1} rounds.`
            : `${score.filled}/${score.total} cells filled so far.`}
        </p>
      </Panel>

      <Button size="lg" onClick={handleRematch}>
        Rematch
      </Button>
    </main>
  );
}
