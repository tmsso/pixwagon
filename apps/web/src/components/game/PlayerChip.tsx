import type { ReactNode } from 'react';
import { patternStyle } from '../../design/patterns.ts';
import { playerColor } from '../../design/tokens.ts';
import { BrokenLinkIcon, DotsIcon, SquaresIcon, TickIcon } from '../ui/icons.tsx';

/** Where a player is in the round (pass 03 note 6, Annotation 33). Each is a
 *  word plus a glyph of its own shape — never colour or a ring alone, so the
 *  four read apart in greyscale. `done` is this round; `finished` is this
 *  picture complete. */
export type PlayerStatus = 'placing' | 'done' | 'finished' | 'away';

const STATUS: Record<PlayerStatus, { word: string; icon: ReactNode; done: boolean }> = {
  placing: { word: 'placing', icon: <DotsIcon />, done: false },
  done: { word: 'done', icon: <TickIcon size={13} strokeWidth={2.4} />, done: true },
  finished: { word: 'finished', icon: <SquaresIcon />, done: true },
  away: { word: 'away', icon: <BrokenLinkIcon />, done: false },
};

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
  /** In-game: where this player is in the round. `connected={false}` is the
   *  same as `status="away"`. Dimming means away and nothing else. */
  status?: PlayerStatus;
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
  status,
}: PlayerChipProps) {
  const color = playerColor(colorIndex);
  const shown = connected ? status : 'away';
  const away = shown === 'away';

  return (
    <div
      className={[
        'inline-flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm',
        active ? 'border-accent bg-surface shadow-sm' : 'border-border bg-surface-sunken',
        away ? 'opacity-50' : '',
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
        <>
          <span className="font-mono text-xs text-ink-muted">{Math.round(completion * 100)}%</span>
          {/* A bar beside the number (Annotation 33): the percentage stays the
              text, the bar is only a faster read of it. */}
          <span aria-hidden className="h-1.5 w-8 rounded-full bg-border">
            <span
              className="block h-full rounded-full bg-ink-muted"
              style={{ width: `${Math.round(completion * 100)}%` }}
            />
          </span>
        </>
      ) : null}
      {shown ? (
        <span
          className={[
            'inline-flex items-center gap-1 text-xs',
            STATUS[shown].done ? 'font-medium text-ink' : 'text-ink-muted',
          ].join(' ')}
        >
          {STATUS[shown].icon}
          {STATUS[shown].word}
        </span>
      ) : null}
    </div>
  );
}
