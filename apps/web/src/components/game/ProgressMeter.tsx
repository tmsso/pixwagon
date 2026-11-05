export interface ProgressMeterProps {
  filled: number;
  total: number;
  /** Shown before the count, e.g. the picture's name. */
  label?: string | undefined;
}

/**
 * "31 / 54 squares" with a bar (pass 04, BRIEF-04 "Richer surfaces"). The
 * count is always in text, so the bar is never the only signal.
 */
export function ProgressMeter({ filled, total, label }: ProgressMeterProps) {
  const percent = total === 0 ? 0 : Math.round((filled / total) * 100);
  return (
    <div className="grid min-w-0 flex-1 gap-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="truncate font-medium text-ink">{label}</span>
        <span className="font-mono whitespace-nowrap text-ink-muted">
          {filled} / {total} squares
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={filled}
        aria-label={
          label ? `${label}: ${filled} of ${total} squares` : `${filled} of ${total} squares`
        }
        className="h-1.5 overflow-hidden rounded-full bg-surface-sunken"
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-normal"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
