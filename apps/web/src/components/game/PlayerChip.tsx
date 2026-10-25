import { patternStyle } from '../../design/patterns.ts';
import { playerColor } from '../../design/tokens.ts';

export interface PlayerChipProps {
  name: string;
  colorIndex: number;
  connected?: boolean;
  /** Shown in own-board mode and on the results screen. */
  score?: number;
  /** How much of their picture a player has filled, 0–1 (D9: what others see
   *  of an opponent mid-game — never the board itself). Shown as text. */
  completion?: number;
  /** Marks whose turn it is to fill. */
  active?: boolean;
  /** The room's host (design pass 02, `02c`–`02e`) — a text label, not a
   *  colour or icon alone. */
  host?: boolean;
  /** Marks the viewer's own chip in the waiting room (pass 03 `02c`–`02e`):
   *  the tag reads "you", "host" or "you · host". In-game the viewer's chip
   *  is named "You" instead. */
  you?: boolean;
}

export function PlayerChip({
  name,
  colorIndex,
  connected = true,
  score,
  completion,
  active = false,
  host = false,
  you = false,
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
      {host || you ? (
        <span className="text-xs text-ink-muted">
          {[you ? 'you' : null, host ? 'host' : null].filter(Boolean).join(' · ')}
        </span>
      ) : null}
      {score !== undefined ? <span className="font-mono text-ink-muted">{score}</span> : null}
      {completion !== undefined ? (
        <span className="font-mono text-xs text-ink-muted">{Math.round(completion * 100)}%</span>
      ) : null}
      {/* Connection state is never colour-only: absent players are also dimmed and labelled. */}
      {!connected ? <span className="text-xs text-ink-muted">away</span> : null}
    </div>
  );
}
