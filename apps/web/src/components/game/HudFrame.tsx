import type { ReactNode } from 'react';

export interface HudFrameProps {
  roomCode?: string;
  round?: number;
  /** Live connection state. Omit entirely for solo/daily — the pill exists
   *  only inside a networked room (docs/design/surfaces/ Annotation 08); a
   *  connection state with no connection to report would be lying, not idle. */
  connection?: 'online' | 'connecting' | 'offline';
  players?: ReactNode;
  children: ReactNode;
  controls?: ReactNode;
}

const CONNECTION_LABEL = {
  online: 'Connected',
  connecting: 'Connecting…',
  offline: 'Offline',
} as const;

/**
 * The in-game chrome: status above, board in the middle, controls pinned within
 * thumb reach at the bottom. Phone-first, so controls go last in both the DOM
 * and the layout rather than being a desktop sidebar that gets reflowed.
 */
export function HudFrame({
  roomCode,
  round,
  connection,
  players,
  children,
  controls,
}: HudFrameProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
        <div className="flex items-baseline gap-3">
          {roomCode ? (
            <span className="font-mono text-lg tracking-widest text-ink">{roomCode}</span>
          ) : null}
          {round !== undefined ? (
            <span className="text-sm text-ink-muted">Round {round}</span>
          ) : null}
        </div>
        {connection ? (
          <span
            className={[
              'rounded-full px-2 py-0.5 text-xs',
              connection === 'online' ? 'text-ink-muted' : 'bg-warning/20 text-ink',
            ].join(' ')}
          >
            {CONNECTION_LABEL[connection]}
          </span>
        ) : null}
      </header>

      {players ? <div className="flex flex-wrap gap-2 px-4 py-2">{players}</div> : null}

      <main className="grid flex-1 place-items-center p-4">{children}</main>

      {controls ? <footer className="border-t border-border p-4">{controls}</footer> : null}
    </div>
  );
}
