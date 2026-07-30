import { Button } from '../ui/Button.tsx';
import { DiceFace } from './DiceFace.tsx';

export interface ComboOptionView {
  id: string;
  label: string;
  cells: number;
}

export interface RollControlProps {
  dice: readonly { sides: number; value: number }[];
  options?: readonly ComboOptionView[];
  selectedOptionId?: string;
  /** True between submitting a fill and the referee's answer. */
  awaitingServer?: boolean;
  rolling?: boolean;
  canRoll?: boolean;
  onRoll?: () => void;
  onSelectOption?: (id: string) => void;
}

/**
 * The roll/combo control from architecture.md §4B.
 *
 * `awaitingServer` is the state that matters most and the one easiest to forget:
 * clients submit intent and the server decides (§5), so there is a real window
 * where the player must not be able to submit again. It disables the controls
 * rather than hiding them, so the layout does not jump.
 */
export function RollControl({
  dice,
  options = [],
  selectedOptionId,
  awaitingServer = false,
  rolling = false,
  canRoll = true,
  onRoll,
  onSelectOption,
}: RollControlProps) {
  const locked = awaitingServer || rolling;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-2">
          {dice.map((die, index) => (
            <DiceFace key={index} value={die.value} sides={die.sides} rolling={rolling} />
          ))}
        </div>
        <Button onClick={onRoll} disabled={!canRoll || locked} loading={rolling}>
          {rolling ? 'Rolling' : 'Roll'}
        </Button>
      </div>

      {options.length > 0 ? (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Combo options">
          {options.map((option) => {
            const selected = option.id === selectedOptionId;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={locked}
                onClick={() => onSelectOption?.(option.id)}
                className={[
                  'min-h-touch rounded-lg border px-3 py-2 text-sm transition-colors duration-fast',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  selected
                    ? 'border-accent bg-accent text-accent-ink'
                    : 'border-border bg-surface text-ink hover:bg-surface-sunken',
                ].join(' ')}
              >
                {option.label}
                <span className="ml-2 font-mono opacity-70">×{option.cells}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {awaitingServer ? (
        <p className="text-sm text-ink-muted" role="status">
          Waiting for the referee…
        </p>
      ) : null}
    </div>
  );
}
