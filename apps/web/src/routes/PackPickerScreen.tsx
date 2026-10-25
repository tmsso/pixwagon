import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { getPack, packs } from '@pixwagon/packs';
import { PackCard } from '../components/game/PackCard.tsx';
import { PicturePreview } from '../components/game/PicturePreview.tsx';
import { Button } from '../components/ui/Button.tsx';
import { BackIcon } from '../components/ui/icons.tsx';
import { Panel } from '../components/ui/Panel.tsx';
import { loadSoloPack, saveSoloPack } from '../state/packChoice.ts';
import { freshSoloConfig, useSoloGameStore } from '../state/soloGame.ts';

/**
 * The pack picker (pass 02 `06`, pass 03 `06a`). Choosing a pack is real
 * since D7: the choice is remembered, "Solo" on Home carries it, and the
 * primary button plays it. Rooms pick their pack in the waiting room instead.
 *
 * Deviation from pass 03 Annotation 31 ("picking a pack returns to Home"):
 * note 17 wins — the button plays *and* remembers — so a pick stays here and
 * is saved as it is made, which means Back keeps it too.
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
    <main className="mx-auto flex min-h-app max-w-md flex-col gap-4 bg-bg p-4">
      <header className="flex items-center gap-2">
        <Link
          to="/"
          aria-label="Back to the start"
          className="grid size-touch place-items-center rounded-lg text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <BackIcon />
        </Link>
        <h1 className="text-2xl font-semibold text-ink">Packs</h1>
      </header>
      <p className="text-sm text-ink-muted">
        Pick the pack Solo plays. A room&rsquo;s host picks theirs in the waiting room.
      </p>

      {/* Rendered straight from packages/packs — proving a pack is data, not code. */}
      <div className="grid gap-3" role="radiogroup" aria-label="Pack">
        {packs.map((pack) => {
          const first = pack.pictures[0];
          return (
            <PackCard
              key={pack.id}
              name={pack.name}
              description={pack.description}
              pictureCount={pack.pictures.length}
              detail={`${pack.pictures.length} pictures · ${pack.pictures.map((p) => p.name).join(', ')}`}
              selected={pack.id === selected.id}
              onSelect={() => choose(pack.id)}
              {...(first ? { preview: { rows: first.rows, palette: first.palette } } : {})}
            />
          );
        })}
      </div>

      <Panel title={`In ${selected.name}`} tone="sunken">
        <div className="flex flex-wrap items-end justify-around gap-4">
          {selected.pictures.map((picture) => (
            <figure key={picture.id} className="grid justify-items-center gap-1">
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

      <div className="flex-1" />

      <div className="grid gap-2 text-center">
        <Button size="lg" onClick={playSolo}>
          Play {selected.name}
        </Button>
        <p className="text-xs text-ink-muted">
          Solo will play {selected.name} from now on. Packs are free and come with updates.
        </p>
      </div>
    </main>
  );
}
