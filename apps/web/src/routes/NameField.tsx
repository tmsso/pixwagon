import { DEFAULT_NAME } from '../state/displayName.ts';

export interface NameFieldProps {
  value: string;
  onChange: (value: string) => void;
}

/** "What should the others call you?" — used by the Lobby and by the name
 *  gate a shared `/r/CODE` link opens on a device with no saved name. */
export function NameField({ value, onChange }: NameFieldProps) {
  return (
    <label className="grid gap-1">
      <span className="text-sm text-ink-muted">Your name</span>
      <input
        className="min-h-touch rounded-lg border-2 border-border bg-surface px-3 text-lg text-ink focus-visible:border-accent focus-visible:outline-none"
        value={value}
        maxLength={24}
        placeholder={DEFAULT_NAME}
        autoComplete="nickname"
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
