import type { ReactNode } from 'react';

export interface DialogProps {
  title: string;
  description?: string;
  open?: boolean;
  footer?: ReactNode;
  children?: ReactNode;
}

/**
 * Phase 0 shell: renders the dialog surface only. Focus trapping, scroll lock
 * and the `<dialog>` element's modal behaviour arrive with the first screen that
 * actually needs a dialog (Phase 2 — leave-room confirmation).
 */
export function Dialog({ title, description, open = true, footer, children }: DialogProps) {
  if (!open) return null;

  return (
    <div className="grid place-items-center bg-slate-950/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-lg"
      >
        <h2 className="text-xl font-semibold text-ink">{title}</h2>
        {description ? <p className="mt-1 text-sm text-ink-muted">{description}</p> : null}
        {children ? <div className="mt-4 text-ink">{children}</div> : null}
        {footer ? <div className="mt-5 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}
