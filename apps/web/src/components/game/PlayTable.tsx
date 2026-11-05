import type { ReactNode, RefObject } from 'react';
import { Link } from 'react-router';
import { HelpIcon, HomeIcon } from '../ui/icons.tsx';

export interface PlayTableProps {
  /** "SOLO", "DAILY" or the room code. */
  title: string;
  /** "Round 4 of 22". */
  round?: string;
  /** Extra header items (picture counter, connection pill). */
  headerExtra?: ReactNode;
  onHelp?: () => void;
  /** The picture card: target thumbnail, name and progress. */
  picture: ReactNode;
  /** Room chips, when there are other players. */
  players?: ReactNode;
  /** The board itself. */
  children: ReactNode;
  /** The element the board is fitted to (`useFitCellSize`). */
  boardAreaRef: RefObject<HTMLDivElement | null>;
  /** One line under the board, always present so it never moves the board. */
  status?: ReactNode;
  /** The tray, or whatever replaces it (a finished-picture card). */
  tray: ReactNode;
  /** Shortcut legend etc. — wide layout only. */
  aside?: ReactNode;
  wide: boolean;
}

/**
 * The pass 04 game layout (BRIEF-04, "Layouts"). Nothing covers the board:
 * the tray is part of the layout, not a sheet over it. Phone and portrait
 * tablet stack header → picture card → board → tray; a wide landscape screen
 * puts the board on the left and a 340 px side panel on the right. Either
 * way the board area is measured and the board fitted to it in whole pixels.
 */
export function PlayTable({
  title,
  round,
  headerExtra,
  onHelp,
  picture,
  players,
  children,
  boardAreaRef,
  status,
  tray,
  aside,
  wide,
}: PlayTableProps) {
  const header = (
    <header className="flex items-center gap-2 border-b border-border px-3 py-1.5">
      <Link
        to="/"
        aria-label="Home"
        title="Home"
        className="grid size-touch place-items-center rounded-full text-ink-muted hover:bg-surface-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
      >
        <HomeIcon />
      </Link>
      <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3">
        <span className="font-mono text-lg tracking-widest text-ink">{title}</span>
        {headerExtra}
        {round ? <span className="text-sm whitespace-nowrap text-ink-muted">{round}</span> : null}
      </div>
      {onHelp ? (
        <button
          type="button"
          onClick={onHelp}
          aria-label="How to play"
          title="How to play"
          className="grid size-touch place-items-center rounded-full text-ink-muted hover:bg-surface-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          <HelpIcon />
        </button>
      ) : null}
    </header>
  );

  const board = (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-2 px-3 py-2">
      {/* `min-h-0` lets this shrink inside the column; the board is fitted to
          whatever it measures, so it can never overflow and push the tray off
          the screen. */}
      <div ref={boardAreaRef} className="grid min-h-0 w-full flex-1 place-items-center">
        {children}
      </div>
      <div className="min-h-5 text-center text-sm text-ink-muted">{status}</div>
    </div>
  );

  if (wide) {
    return (
      <div className="grid h-app grid-cols-[minmax(0,1fr)_21.25rem] bg-bg">
        <div className="flex min-h-0 flex-col">
          {header}
          {board}
        </div>
        <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto border-l border-border bg-surface p-4">
          {picture}
          <div className="border-t border-border pt-4">{tray}</div>
          {players ? <div className="flex flex-wrap gap-2">{players}</div> : null}
          <div className="flex-1" />
          {aside}
        </aside>
      </div>
    );
  }

  return (
    <div className="flex h-app flex-col bg-bg">
      {header}
      <div className="px-3 pt-2">{picture}</div>
      {players ? (
        <div className="flex flex-wrap content-start gap-2 px-3 pt-2">{players}</div>
      ) : null}
      {board}
      <div className="border-t border-border bg-surface px-3 pt-3 pb-3">{tray}</div>
    </div>
  );
}
