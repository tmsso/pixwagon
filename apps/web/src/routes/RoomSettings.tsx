import { packs, getPack } from '@pixwagon/packs';
import type { RoomMode, RoomSnapshot } from '@pixwagon/protocol';
import { PackCard } from '../components/game/PackCard.tsx';
import { Panel } from '../components/ui/Panel.tsx';
import { useRoomGameStore } from '../state/roomGame.ts';

/**
 * The waiting room's "Boards" panel (Phase 6, D7): the host picks the mode
 * and the pack, everyone else sees the choice read-only, updated live by the
 * server's `state` broadcast. Provisional — pass 02 `02c`–`02e` extended;
 * design pass 03 Part B redesigns it.
 */

const MODES: { mode: RoomMode; title: string; line: string }[] = [
  {
    mode: 'same-board',
    title: 'Same board',
    line: 'Everyone fills the same picture from the same offers.',
  },
  {
    mode: 'own-board',
    title: 'Own board',
    line: 'Everyone gets a different picture from the same offers. Compared at the end.',
  },
];

export function RoomSettings({ snapshot, isHost }: { snapshot: RoomSnapshot; isHost: boolean }) {
  const configure = useRoomGameStore((state) => state.configure);
  const pack = getPack(snapshot.packId);
  const current = MODES.find((m) => m.mode === snapshot.mode) ?? MODES[0]!;
  const pictures = pack
    ? `${pack.name} · ${pack.pictures.length} pictures, one after another.`
    : '';

  if (!isHost) {
    return (
      <Panel title="Boards" tone="sunken">
        <p className="font-medium">{current.title}</p>
        <p className="text-sm text-ink-muted">
          {current.line} {pictures}
        </p>
        <p className="mt-2 text-xs text-ink-muted">The host chooses the mode and the pack.</p>
      </Panel>
    );
  }

  return (
    <Panel title="Boards" tone="sunken">
      <div className="grid gap-2" role="group" aria-label="Mode">
        {MODES.map(({ mode, title, line }) => {
          const selected = mode === snapshot.mode;
          return (
            <button
              key={mode}
              type="button"
              aria-pressed={selected}
              onClick={() => configure({ mode })}
              className={[
                'flex min-h-touch w-full items-start gap-3 rounded-xl border p-3 text-left',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                selected ? 'border-accent bg-surface shadow-md' : 'border-border bg-surface',
              ].join(' ')}
            >
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-ink">{title}</span>
                <span className="block text-sm text-ink-muted">{line}</span>
              </span>
              {/* Selection is a glyph as well as a border (CLAUDE.md §6). */}
              <span aria-hidden className={selected ? 'text-accent' : 'text-transparent'}>
                ✓
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-4 mb-2 text-sm font-medium text-ink">Pack</p>
      <div className="grid gap-2" role="group" aria-label="Pack">
        {packs.map((candidate) => {
          const first = candidate.pictures[0];
          return (
            <PackCard
              key={candidate.id}
              name={candidate.name}
              description={candidate.description}
              pictureCount={candidate.pictures.length}
              selected={candidate.id === snapshot.packId}
              onSelect={() => configure({ packId: candidate.id })}
              {...(first ? { preview: { rows: first.rows, palette: first.palette } } : {})}
            />
          );
        })}
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        Pictures play one after another; the room moves on together.
      </p>
    </Panel>
  );
}
