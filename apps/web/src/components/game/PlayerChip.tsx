import { patternStyle } from '../../design/patterns.ts';
import { playerColor } from '../../design/tokens.ts';

export interface PlayerChipProps {
  name: string;
  colorIndex: number;
  connected?: boolean;
  /** Shown in own-board mode and on the results screen. */
  score?: number;
  /** Marks whose turn it is to fill. */
  active?: boolean;
}

export function PlayerChip({
  name,
  colorIndex,
  connected = true,
  score,
  active = false,
}: PlayerChipProps) {
  const color = playerColor(colorIndex);

  return (
    <div
      className={[
        'inline-flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm',
        active ? 'border-accent bg-surface shadow-sm' : 'border-border bg-surface-sunken',
        connected ? '' : 'opacity-50',
      ].join(' ')}
    >
      {/* Swatch carries both hue and hatch — see design/patterns.ts. */}
      <span
        aria-hidden
        className="size-5 rounded-full border border-black/10"
        style={patternStyle(color.pattern, color.hex)}
      />
      <span className="font-medium text-ink">{name}</span>
      {score !== undefined ? <span className="font-mono text-ink-muted">{score}</span> : null}
      {/* Connection state is never colour-only: absent players are also dimmed and labelled. */}
      {!connected ? <span className="text-xs text-ink-muted">away</span> : null}
    </div>
  );
}
