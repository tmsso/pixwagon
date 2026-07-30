import type { ReactNode } from 'react';

export interface PanelProps {
  title?: string;
  /** `sunken` reads as background, `raised` as foreground. */
  tone?: 'raised' | 'sunken';
  footer?: ReactNode;
  children: ReactNode;
}

export function Panel({ title, tone = 'raised', footer, children }: PanelProps) {
  return (
    <section
      className={[
        'rounded-xl border border-border p-4',
        tone === 'raised' ? 'bg-surface shadow-sm' : 'bg-surface-sunken',
      ].join(' ')}
    >
      {title ? (
        <h2 className="mb-2 text-sm font-semibold tracking-wide text-ink-muted uppercase">
          {title}
        </h2>
      ) : null}
      <div className="text-ink">{children}</div>
      {footer ? <div className="mt-4 border-t border-border pt-3">{footer}</div> : null}
    </section>
  );
}
