import { useEffect, useRef } from 'react';
import { getPack, packs } from '@pixwagon/packs';
import type { GameMode, RoomMode, RoomSnapshot } from '@pixwagon/protocol';
import { PackCard } from '../../components/game/PackCard.tsx';
import { PicturePreview } from '../../components/game/PicturePreview.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { PencilIcon } from '../../components/ui/icons.tsx';
import { Segmented } from '../../components/ui/Segmented.tsx';
import { useRoomGameStore } from '../../state/roomGame.ts';
import type { ConfigChange } from '../../state/roomGame.ts';
import { hostName } from '../../state/roomView.ts';

/**
 * "This game" — what the room is about to play (pass 03 `02c`–`02e`, `02h`,
 * `02i`; note 3). The waiting room only ever shows a one-line summary; the
 * host's choices live in a sheet (`GameSheet`) so the room stays calm for
 * everyone else. D7 (pack) and Phase 6 (mode) are unchanged underneath.
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
    line: 'Each of you gets a different picture from the pack. Same offers for everyone; boards side by side at the end.',
  },
];

function modeTitle(mode: GameMode): string {
  return MODES.find((m) => m.mode === mode)?.title ?? mode;
}

/** "Same board · Transportation". */
function describeChoice(mode: GameMode, packId: string): string {
  return `${modeTitle(mode)} · ${getPack(packId)?.name ?? packId}`;
}

/** The summary panel: thumbnail, the choice in words, and — for the host —
 *  a Change button. Guests get the same panel with who picks, plus (`02i`) one
 *  line naming what the host just changed. */
export function GameSummary({
  snapshot,
  isHost,
  configChange,
  onChange,
}: {
  snapshot: RoomSnapshot;
  isHost: boolean;
  configChange: ConfigChange | null;
  onChange: () => void;
}) {
  const pack = getPack(snapshot.packId);
  const first = pack?.pictures[0];
  const count = pack?.pictures.length ?? 0;
  const detail =
    snapshot.mode === 'own-board'
      ? `A different picture each, ${count} in turn`
      : `${count} pictures, played in turn`;

  return (
    <section className="rounded-xl border border-border bg-surface-sunken p-4">
      <div className="flex items-center gap-3">
        {first ? (
          <PicturePreview
            rows={first.rows}
            palette={first.palette}
            cellSize={6}
            label={first.name}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="font-mono text-xs tracking-widest text-ink-muted uppercase">This game</h2>
          <p className="font-medium text-ink">{describeChoice(snapshot.mode, snapshot.packId)}</p>
          <p className="text-sm text-ink-muted">
            {detail}
            {isHost ? '' : ` · ${hostName(snapshot)} picks`}
          </p>
        </div>
        {isHost ? (
          // A text button rather than `Button variant="ghost"`: its own text
          // colour would fight the accent one for specificity.
          <button
            type="button"
            onClick={onChange}
            className="min-h-touch rounded-md px-2 font-medium text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Change
          </button>
        ) : null}
      </div>
      {!isHost && configChange ? (
        <p className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-sm text-ink">
          <PencilIcon />
          <span>
            {hostName(snapshot)} changed this from{' '}
            {describeChoice(configChange.from.mode, configChange.from.packId)}.
          </span>
        </p>
      ) : null}
    </section>
  );
}

/** The host's bottom sheet over the waiting room (`02h`). Choices apply as
 *  they're made — the server's `state` broadcast is the only confirmation,
 *  nothing is predicted — so "Done" just closes. */
export function GameSheet({ snapshot, onClose }: { snapshot: RoomSnapshot; onClose: () => void }) {
  const configure = useRoomGameStore((state) => state.configure);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const current = MODES.find((m) => m.mode === snapshot.mode) ?? MODES[0]!;

  useEffect(() => {
    // Keyboard and screen-reader users land inside the sheet, and go back to
    // the Change button they pressed when it closes.
    const opener = document.activeElement as HTMLElement | null;
    titleRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-30">
      <div className="absolute inset-0 bg-slate-950/20" aria-hidden onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-sheet-title"
        className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[78dvh] max-w-md flex-col gap-3 rounded-t-xl border-t border-border bg-surface px-4 pt-2.5 pb-4 shadow-lg"
      >
        <span className="mx-auto h-1 w-9 shrink-0 rounded-full bg-border" aria-hidden />
        <h2
          id="game-sheet-title"
          ref={titleRef}
          tabIndex={-1}
          className="text-lg font-semibold text-ink outline-none"
        >
          This game
        </h2>
        <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto">
          <div className="grid gap-2">
            <p className="font-mono text-xs tracking-widest text-ink-muted uppercase">Boards</p>
            <Segmented
              label="Boards"
              options={MODES.map((m) => ({ value: m.mode, label: m.title }))}
              // A room only ever holds a room mode; solo and daily are
              // local stores that never reach the waiting room.
              value={current.mode}
              onChange={(mode) => configure({ mode })}
            />
            <p className="text-sm text-ink-muted">{current.line}</p>
          </div>
          <div className="grid gap-2">
            <p className="font-mono text-xs tracking-widest text-ink-muted uppercase">Pack</p>
            <div className="grid gap-2" role="radiogroup" aria-label="Pack">
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
            <p className="text-xs text-ink-muted">
              More packs arrive with app updates and appear here; the list scrolls.
            </p>
          </div>
        </div>
        <Button size="lg" className="shrink-0" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}
