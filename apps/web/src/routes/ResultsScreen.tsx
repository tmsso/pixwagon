import { PicturePreview } from '../components/game/PicturePreview.tsx';
import { PlayerChip } from '../components/game/PlayerChip.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Panel } from '../components/ui/Panel.tsx';
import { transportation } from '@pixwagon/packs';
import { ScaffoldNotice } from './ScaffoldNotice.tsx';

export function ResultsScreen() {
  const picture = transportation.pictures[0];

  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-center gap-6 bg-bg p-6">
      <h1 className="text-center text-2xl font-semibold text-ink">Round over</h1>

      {picture ? (
        <Panel title={picture.name}>
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

      <Panel title="Scores" tone="sunken">
        <div className="grid gap-2">
          <PlayerChip name="Tamas" colorIndex={0} score={38} />
          <PlayerChip name="Guest" colorIndex={1} score={31} />
        </div>
      </Panel>

      <Button size="lg">Rematch</Button>

      <ScaffoldNotice phase="Phase 6" />
    </main>
  );
}
