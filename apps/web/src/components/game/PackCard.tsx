import { PicturePreview } from './PicturePreview.tsx';

export interface PackCardProps {
  name: string;
  description: string;
  pictureCount: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  selected?: boolean;
  /** Optional thumbnail drawn from one of the pack's pictures. */
  preview?: {
    rows: readonly string[];
    palette: readonly { name: string; hex: string }[];
  };
  onSelect?: () => void;
}

const DIFFICULTY_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' } as const;

export function PackCard({
  name,
  description,
  pictureCount,
  difficulty,
  selected = false,
  preview,
  onSelect,
}: PackCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={[
        'flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors duration-fast',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        selected
          ? 'border-accent bg-surface shadow-md'
          : 'border-border bg-surface hover:bg-surface-sunken',
      ].join(' ')}
    >
      {preview ? (
        <div className="shrink-0 rounded-md bg-surface-sunken p-2">
          <PicturePreview rows={preview.rows} palette={preview.palette} cellSize={5} label={name} />
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <h3 className="truncate font-semibold text-ink">{name}</h3>
          {difficulty ? (
            <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs text-ink-muted">
              {DIFFICULTY_LABEL[difficulty]}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-sm text-ink-muted">{description}</p>
        <p className="mt-1 font-mono text-xs text-ink-muted">{pictureCount} pictures</p>
      </div>

      {/* Selection is marked by a glyph as well as by colour and border. */}
      <span aria-hidden className={selected ? 'text-accent' : 'text-transparent'}>
        ✓
      </span>
    </button>
  );
}
