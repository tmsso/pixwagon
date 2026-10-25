import type { ReactNode } from 'react';
import { PicturePreview } from './PicturePreview.tsx';

export interface PictureStripProps {
  rows: readonly string[];
  palette: readonly { name: string; hex: string }[];
  /** The picture's name, for the preview's accessible label. */
  label: string;
  /** Small mono line above the title ("Picture 1 · Tram"). */
  eyebrow: string;
  title: string;
  /** Preview cell size in px: bigger in the footer card, smaller up top. */
  cellSize?: number;
  children?: ReactNode;
}

/**
 * A finished picture reported in words (pass 03 `12f`, `12i`): a preview in the
 * picture's own palette and what it scored. Used twice — as the footer card
 * that replaces the offers once your picture is complete, and as the strip
 * above the new board after the room moves on. Never colour alone: the score is
 * in the text.
 */
export function PictureStrip({
  rows,
  palette,
  label,
  eyebrow,
  title,
  cellSize = 4,
  children,
}: PictureStripProps) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-surface p-3">
      <div className="shrink-0 rounded-md bg-surface-sunken p-1.5">
        <PicturePreview rows={rows} palette={palette} cellSize={cellSize} label={label} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-xs tracking-widest text-ink-muted uppercase">{eyebrow}</p>
        <p className="font-medium text-ink">{title}</p>
        {children ? <div className="mt-1 text-sm text-ink-muted">{children}</div> : null}
      </div>
    </div>
  );
}
