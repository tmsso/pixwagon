export interface RoomCodeInputProps {
  value?: string;
  length?: number;
  invalid?: boolean;
  /** Replaces the default invalid-state copy. */
  errorMessage?: string;
  onChange?: (value: string) => void;
  /** Enter / the keyboard's "Go" key. */
  onSubmit?: () => void;
}

/**
 * Room codes get read aloud across a table, so they render monospaced and
 * per-character. The boxes are presentation; the real control is one visually
 * hidden `<input>`. Wrapping both in a `<label>` is what makes tapping a box
 * focus that input (and raise the phone keyboard) with no click handler.
 */
export function RoomCodeInput({
  value = '',
  length = 4,
  invalid = false,
  errorMessage = 'No room with that code.',
  onChange,
  onSubmit,
}: RoomCodeInputProps) {
  const chars = Array.from({ length }, (_, i) => value[i] ?? '');

  return (
    <div>
      <label className="block w-fit rounded-lg focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent">
        <div className="flex gap-2" aria-hidden>
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
        <input
          className="sr-only"
          value={value}
          maxLength={length}
          aria-label="Room code"
          aria-invalid={invalid || undefined}
          // Phone keyboards: capitals on, no autocorrect "fixing" a code.
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          // Pasted codes often carry a space or dash ("PX-WG"); keep only the
          // letters and digits. Look-alikes (I, O, 0, 1) are kept so the
          // caller can say why the code is wrong rather than silently eat them.
          onChange={(event) =>
            onChange?.(
              event.target.value
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, '')
                .slice(0, length),
            )
          }
          onKeyDown={(event) => {
            if (event.key === 'Enter') onSubmit?.();
          }}
        />
      </label>
      <p className="mt-2 font-mono text-xs text-ink-muted">A–Z without I, O, 0 or 1</p>
      {invalid ? (
        <p role="alert" className="mt-1 text-sm text-danger">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
