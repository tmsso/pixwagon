export interface SegmentedProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Names the group for assistive tech ("Boards"). */
  label: string;
}

/**
 * Two or three exclusive choices side by side (pass 03 `02h`, the "Same board
 * / Own board" switch). A radio group, not tabs: it changes a setting, it
 * doesn't reveal different content. The selected segment is raised and bold,
 * so it isn't distinguished by tone alone.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex gap-1 rounded-xl border border-border bg-surface-sunken p-1"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={[
              'min-h-touch flex-1 rounded-lg px-3 text-base transition-colors duration-fast',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              selected ? 'bg-surface font-semibold text-ink shadow-sm' : 'text-ink-muted',
            ].join(' ')}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
