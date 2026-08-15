import { Link } from 'react-router';
import { packs } from '@pixwagon/packs';
import { PackCard } from '../components/game/PackCard.tsx';
import { PicturePreview } from '../components/game/PicturePreview.tsx';
import { Panel } from '../components/ui/Panel.tsx';

export function PackPickerScreen() {
  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-start gap-6 bg-bg p-6">
      <h1 className="text-2xl font-semibold text-ink">Shape packs</h1>
      {/* Only one pack ships in Phase 2; a picker that only ever has one
          thing to pick is still the real screen — Phase 8 (a second pack,
          purely as data) is the actual test of whether "selected" needs to
          do anything yet. */}

      {/* Rendered straight from packages/packs — proving a pack is data, not code. */}
      <div className="grid gap-3">
        {packs.map((pack, index) => {
          const first = pack.pictures[0];
          return (
            <PackCard
              key={pack.id}
              name={pack.name}
              description={pack.description}
              pictureCount={pack.pictures.length}
              selected={index === 0}
              {...(first ? { preview: { rows: first.rows, palette: first.palette } } : {})}
            />
          );
        })}
      </div>

      <Panel title="Pictures in this pack" tone="sunken">
        <div className="flex flex-wrap items-end gap-4">
          {packs[0]?.pictures.map((picture) => (
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

      <Link to="/" className="text-center text-sm text-accent underline">
        Back home
      </Link>
    </main>
  );
}
