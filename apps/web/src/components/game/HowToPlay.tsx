import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Button } from '../ui/Button.tsx';
import { BoardCell } from './BoardCell.tsx';
import { PieceGlyph } from './PieceGlyph.tsx';
import { BlobRun } from './PieceTile.tsx';

export interface HowToPlayProps {
  open: boolean;
  onClose: () => void;
}

/**
 * The three-step rules dialog (pass 04, BRIEF-04 "Richer surfaces";
 * handoff-04 `HowToPlay`). A native `<dialog>` opened with `showModal()`:
 * the browser then traps focus inside it, closes it on Esc and makes the page
 * behind inert — the modal behaviour `ui/Dialog.tsx`'s shell never had.
 * Drawn with the real `PieceGlyph` and `BoardCell`, not pictures of them.
 */
export function HowToPlay({ open, onClose }: HowToPlayProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal?.();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="how-to-play-title"
      onClose={onClose}
      onCancel={onClose}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl outline-none border border-border bg-surface p-0 text-ink shadow-lg backdrop:bg-slate-950/40"
    >
      <div className="grid max-h-[85dvh] gap-4 overflow-y-auto p-5">
        <h2 id="how-to-play-title" className="text-xl font-semibold">
          How to play
        </h2>
        <ol className="grid gap-4">
          <Step
            n={1}
            title="Pick a piece"
            art={
              <div className="flex items-end gap-2">
                <PieceGlyph cells={L} cellSize={10} />
                <PieceGlyph cells={I3} cellSize={10} />
                <span className="px-1 text-xs text-ink-muted">or</span>
                <BlobRun size={2} cellSize={10} />
              </div>
            }
          >
            Each round offers <b>the pair</b> — two pieces you place together — or <b>the single</b>
            : a group of touching squares you paint yourself. Take one or the other.
          </Step>
          <Step
            n={2}
            title="Drop it on the picture"
            art={
              <MiniBoard
                rows={['..##.', '.LL#.', '.L...']}
                legend={{ '#': 'filled', L: 'candidate', '.': 'fillable' }}
              />
            }
          >
            Click or tap a square to drop it there, or drag it from the tray. Turn it with a
            right-click, <kbd className="font-mono">R</kbd> or a tap on it; flip it with{' '}
            <kbd className="font-mono">F</kbd>. Nothing is final until <b>✓ Place</b>.
          </Step>
          <Step
            n={3}
            title="Fill every square"
            art={
              <MiniBoard rows={['###', '#.#', '###']} legend={{ '#': 'filled', '.': 'fillable' }} />
            }
          >
            A finished picture scores; an unfinished one scores nothing. Watch for squares left on
            their own — only a single of 1 can fill them, and the board marks them with a dotted
            ring before you place.
          </Step>
        </ol>
        <Button size="lg" onClick={onClose}>
          Got it
        </Button>
      </div>
    </dialog>
  );
}

const L = [
  { x: 0, y: 0 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
];
const I3 = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 2, y: 0 },
];

function Step({
  n,
  title,
  art,
  children,
}: {
  n: number;
  title: string;
  art: ReactNode;
  children: ReactNode;
}) {
  return (
    <li className="grid grid-cols-[auto_1fr] items-start gap-3">
      <span className="grid size-7 place-items-center rounded-full bg-accent font-mono text-sm text-accent-ink">
        {n}
      </span>
      <div className="grid gap-2">
        <h3 className="font-semibold">{title}</h3>
        <div aria-hidden className="w-max rounded-lg border border-border bg-bg p-2">
          {art}
        </div>
        <p className="text-sm text-ink-muted">{children}</p>
      </div>
    </li>
  );
}

function MiniBoard({
  rows,
  legend,
}: {
  rows: readonly string[];
  legend: Record<string, 'filled' | 'candidate' | 'fillable' | 'blank'>;
}) {
  return (
    <div
      className="grid"
      style={{ gridTemplateColumns: `repeat(${rows[0]!.length}, 16px)`, lineHeight: 0 }}
    >
      {rows.flatMap((row, y) =>
        Array.from(row).map((char, x) => (
          <BoardCell key={`${x}-${y}`} state={legend[char] ?? 'blank'} size={16} />
        )),
      )}
    </div>
  );
}
