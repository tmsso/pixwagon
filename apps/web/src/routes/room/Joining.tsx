import { useEffect, useState } from 'react';
import type { ComponentProps } from 'react';
import { HudFrame } from '../../components/game/HudFrame.tsx';

/**
 * The two "waiting for the room to answer" states (pass 03 `12h`, notes 16 and
 * Annotation 17). Each is drawn in the shape of the screen that comes next —
 * the waiting room's code and panel outlines, or the game frame with a
 * board-sized placeholder — so when the real thing arrives nothing moves.
 * Neither shows anything but the background for the first 400 ms: a room that
 * answers quickly never flashes a loading state at all.
 */

/** How long a wait must last before it is worth showing. */
const SHOW_AFTER_MS = 400;

/** Becomes true once `delayMs` has passed. The state update lives in the timer
 *  callback, never in the effect body or render; `delayMs` 0 starts visible,
 *  which is what a server render (and `scripts/check-screens.tsx`) needs. */
function useAfterDelay(delayMs: number): boolean {
  const [shown, setShown] = useState(delayMs === 0);
  useEffect(() => {
    if (delayMs === 0) return;
    const timer = setTimeout(() => setShown(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);
  return shown;
}

/** A placeholder block. The pulse is `motion-safe:` so reduced-motion users
 *  get a still block, not a throbbing one (CLAUDE.md §6). */
function Skel({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={['block bg-surface-sunken motion-safe:animate-pulse', className].join(' ')}
    />
  );
}

/** Joining a room, before its first `state` arrives. */
export function JoiningRoom({ code, delayMs = SHOW_AFTER_MS }: { code: string; delayMs?: number }) {
  const shown = useAfterDelay(delayMs);
  return (
    <main className="mx-auto flex min-h-app max-w-md flex-col gap-4 bg-bg p-4">
      {shown ? (
        <>
          <div className="grid justify-items-center gap-2 pt-3">
            <span className="font-mono text-xs tracking-widest text-ink-muted uppercase">
              Room code
            </span>
            <p className="font-mono text-4xl font-bold tracking-widest text-ink">{code}</p>
            <Skel className="h-9 w-28 rounded-lg" />
          </div>
          <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold tracking-wide text-ink-muted uppercase">
              Players
            </h2>
            <div className="flex gap-2">
              <Skel className="h-7 w-24 rounded-full" />
              <Skel className="h-7 w-[4.5rem] rounded-full" />
            </div>
          </section>
          <p className="text-center text-sm text-ink-muted" role="status">
            Joining room <span className="font-mono tracking-widest text-ink">{code}</span>…
          </p>
          <div className="flex-1" />
          <Skel className="h-[3.25rem] w-full rounded-xl" />
        </>
      ) : null}
    </main>
  );
}

/** Mid-game, connected but the board hasn't arrived yet (`state` follows
 *  `welcome`). `hud` carries the real header and player chips, which are known
 *  already; only the board and the offers are placeholders. */
export function JoiningBoard({
  hud,
  delayMs = SHOW_AFTER_MS,
}: {
  hud: Omit<ComponentProps<typeof HudFrame>, 'children' | 'controls' | 'sheet'>;
  delayMs?: number;
}) {
  const shown = useAfterDelay(delayMs);
  return (
    <HudFrame
      {...hud}
      // The footer's height is reserved from the first frame, so the
      // placeholders appearing at 400 ms don't move the board's centre.
      controls={
        <div className="flex h-[6.5rem] gap-3">
          {shown ? (
            <>
              <Skel className="flex-1 rounded-xl" />
              <Skel className="flex-1 rounded-xl" />
            </>
          ) : null}
        </div>
      }
    >
      {shown ? (
        <div className="grid justify-items-center gap-3">
          <Skel className="h-[11.5rem] w-[16.8rem] rounded-xl" />
          <p className="text-sm text-ink-muted" role="status">
            Getting your board…
          </p>
        </div>
      ) : null}
    </HudFrame>
  );
}
