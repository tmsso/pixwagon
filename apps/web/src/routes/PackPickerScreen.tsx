import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { getPack, packs } from '@pixwagon/packs';
import { PackCard } from '../components/game/PackCard.tsx';
import { PicturePreview } from '../components/game/PicturePreview.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Panel } from '../components/ui/Panel.tsx';
import { loadSoloPack, saveSoloPack } from '../state/packChoice.ts';
import { freshSoloConfig, useSoloGameStore } from '../state/soloGame.ts';

/**
 * The pack picker (pass 02 `06`). Since D7 (2026-10-22) choosing a pack is
 * real: the choice is remembered and "Solo" on Home plays it. Rooms pick
 * their pack in the waiting room instead. Provisional placement of the
 * choice — design pass 03 Part B may move it.
 */
export function PackPickerScreen() {
  const navigate = useNavigate();
  const start = useSoloGameStore((state) => state.start);
  // Read once on mount: localStorage is the only writer besides this screen.
  const [selectedId, setSelectedId] = useState(loadSoloPack);
  const selected = getPack(selectedId) ?? packs[0]!;

  function choose(packId: string) {
    setSelectedId(packId);
    saveSoloPack(packId);
  }

  function playSolo() {
    start(freshSoloConfig(selected.id));
    navigate('/r/solo');
  }

  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-start gap-6 bg-bg p-6">
      <h1 className="text-2xl font-semibold text-ink">Shape packs</h1>

      {/* Rendered straight from packages/packs — proving a pack is data, not code. */}
      <div className="grid gap-3">
        {packs.map((pack) => {
          const first = pack.pictures[0];
          return (
            <PackCard
              key={pack.id}
              name={pack.name}
              description={pack.description}
              pictureCount={pack.pictures.length}
              selected={pack.id === selected.id}
              onSelect={() => choose(pack.id)}
              {...(first ? { preview: { rows: first.rows, palette: first.palette } } : {})}
            />
          );
        })}
      </div>

      <Panel title={`Pictures in ${selected.name}`} tone="sunken">
        <div className="flex flex-wrap items-end gap-4">
          {selected.pictures.map((picture) => (
            <figure key={picture.id} className="grid gap-1">
              <PicturePreview
                rows={picture.rows}
                palette={picture.palette}
                cellSize={7}
                label={picture.name}
              />
              <figcaption className="text-xs text-ink-muted">{picture.name}</figcaption>
            </figure>
          ))}
        </div>
      </Panel>

      <div className="grid gap-2 text-center">
        <Button size="lg" onClick={playSolo}>
          Play solo with {selected.name}
        </Button>
        <p className="text-sm text-ink-muted">Solo on the home screen remembers this pack.</p>
      </div>

      <Link to="/" className="text-center text-sm text-accent underline">
        Back home
      </Link>
    </main>
  );
}
