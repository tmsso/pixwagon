export interface RoomCodeInputProps {
  value?: string;
  length?: number;
  invalid?: boolean;
  onChange?: (value: string) => void;
}

/**
 * Room codes get read aloud across a table, so they render monospaced and
 * per-character. Phase 0 shell: shows the boxes and their states; the paste
 * handling, auto-advance and mobile keyboard hints come with the lobby screen.
 */
export function RoomCodeInput({
  value = '',
  length = 4,
  invalid = false,
  onChange,
}: RoomCodeInputProps) {
  const chars = Array.from({ length }, (_, i) => value[i] ?? '');

  return (
    <div>
      <div className="flex gap-2" role="group" aria-label="Room code">
        {chars.map((char, index) => (
          <div
            key={index}
            className={[
              'grid size-touch place-items-center rounded-lg border-2 font-mono text-2xl',
              'bg-surface text-ink',
              invalid ? 'border-danger' : char ? 'border-accent' : 'border-border',
            ].join(' ')}
          >
            {char || <span className="text-ink-muted">·</span>}
          </div>
        ))}
      </div>
      {/* The real control; the boxes above are presentation. */}
      <input
        className="sr-only"
        value={value}
        maxLength={length}
        aria-label="Room code"
        aria-invalid={invalid || undefined}
        onChange={(event) => onChange?.(event.target.value.toUpperCase())}
      />
      {invalid ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          No room with that code.
        </p>
      ) : null}
    </div>
  );
}
