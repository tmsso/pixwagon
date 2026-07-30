import { packs } from '@pixwagon/packs';
import { PackCard } from '../components/game/PackCard.tsx';
import { PicturePreview } from '../components/game/PicturePreview.tsx';
import { Panel } from '../components/ui/Panel.tsx';
import { ScaffoldNotice } from './ScaffoldNotice.tsx';

export function PackPickerScreen() {
  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-start gap-6 bg-bg p-6">
      <h1 className="text-2xl font-semibold text-ink">Shape packs</h1>

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

      <ScaffoldNotice phase="Phase 2" />
    </main>
  );
}
