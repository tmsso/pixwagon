import type { ReactNode } from 'react';

export interface HudFrameProps {
  roomCode?: string;
  round?: number;
  /** Rounds the picture in play gets (rooms, D3) — shown as "Round 3 of 25". */
  roundOf?: number;
  /** Picture cycling (Phase 6, D8): "Picture 2 of 3". Omitted for solo, which
   *  plays one picture. */
  picture?: { index: number; count: number };
  /** Live connection state. Omit entirely for solo/daily — the pill exists
   *  only inside a networked room (docs/design/surfaces/ Annotation 08); a
   *  connection state with no connection to report would be lying, not idle. */
  connection?: 'online' | 'connecting' | 'reconnecting' | 'offline';
  players?: ReactNode;
  children: ReactNode;
  controls?: ReactNode;
  /** The composition sheet (design pass 02, Annotation 12). When present it
   *  rises over the board on a scrim at a fixed 284px; `main` reserves exactly
   *  that height as bottom padding so the board re-centres into the space left
   *  above it and never changes size. Mutually exclusive with `controls` in
   *  practice — the offers footer is gone while the sheet is up. */
  sheet?: ReactNode;
}

/** 34% of an 844px reference viewport — fixed so switching offers, or going
 *  from 0 to 2 pieces placed, never resizes the sheet or shifts the board. */
const SHEET_HEIGHT = 284;

const CONNECTION_LABEL = {
  online: 'Connected',
  connecting: 'Connecting…',
  // A drop being retried, as distinct from a first connect — the wording the
  // device checklist (ROADMAP.md step 4) looks for. Same warning tone, never
  // red (design pass 02, Annotation 19).
  reconnecting: 'Reconnecting…',
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
  roundOf,
  picture,
  connection,
  players,
  children,
  controls,
  sheet,
}: HudFrameProps) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-bg">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
        <div className="flex items-baseline gap-3">
          {roomCode ? (
            <span className="font-mono text-lg tracking-widest text-ink">{roomCode}</span>
          ) : null}
          {picture && picture.count > 1 ? (
            // Three small squares and "2 of 3": the full "Picture 2 of 3"
            // doesn't fit beside the code, the round and the pill at 390 px
            // (pass 03 note 8), so it lives on as the accessible name. The
            // filled squares are the pictures reached so far; the number says
            // it in text too.
            <span
              role="img"
              aria-label={`Picture ${picture.index} of ${picture.count}`}
              className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-ink"
            >
              <span aria-hidden className="flex gap-[3px]">
                {Array.from({ length: picture.count }, (_, i) => (
                  <i
                    key={i}
                    className={[
                      'block size-2 rounded-[2px] border border-ink-muted',
                      i < picture.index ? 'bg-ink-muted' : '',
                    ].join(' ')}
                  />
                ))}
              </span>
              <span aria-hidden>
                {picture.index} of {picture.count}
              </span>
            </span>
          ) : null}
          {round !== undefined ? (
            <span className="text-sm text-ink-muted">
              Round {round}
              {roundOf !== undefined ? ` of ${roundOf}` : ''}
            </span>
          ) : null}
        </div>
        {connection ? (
          <span
            role="status"
            className={[
              'rounded-full px-2 py-0.5 text-xs',
              connection === 'online' ? 'text-ink-muted' : 'bg-warning/20 text-ink',
            ].join(' ')}
          >
            {CONNECTION_LABEL[connection]}
          </span>
        ) : null}
      </header>

      {/* Two rows are reserved from the first frame (pass 03 note 6): six chips
          with tags wrap to two rows at 390 px, and a tag changing width mid-
          round must never push the board down. 5.5rem = two 2rem chips, the
          gap, and the padding. */}
      {players ? (
        <div className="flex min-h-22 flex-wrap content-start gap-2 px-4 py-2">{players}</div>
      ) : null}

      <main
        className="grid flex-1 place-items-center p-4"
        style={sheet ? { paddingBottom: SHEET_HEIGHT } : undefined}
      >
        {children}
      </main>

      {sheet ? (
        <>
          {/* Scrim dims the board behind the sheet. `pointer-events-none` is
              load-bearing, not cosmetic: the placement gesture is *tapping the
              board* (Annotation 09), so the board must stay hittable through
              the scrim — an intercepting overlay would make the piece
              impossible to place. The design's value is rgb(14 18 22 / .18);
              slate-950/20 is the closest utility and matches `Dialog`. */}
          <div className="pointer-events-none absolute inset-0 z-10 bg-slate-950/20" aria-hidden />
          <div
            className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-3 rounded-t-xl border-t border-border bg-surface px-4 pb-4 pt-2.5 shadow-lg"
            style={{ height: SHEET_HEIGHT }}
          >
            <span className="mx-auto h-1 w-9 rounded-full bg-border" aria-hidden />
            {sheet}
          </div>
        </>
      ) : null}

      {controls && !sheet ? (
        <footer className="border-t border-border p-4">{controls}</footer>
      ) : null}
    </div>
  );
}
