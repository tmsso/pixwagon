export interface DiceFaceProps {
  value: number;
  sides?: number;
  /** Mid-roll shimmer, before the referee's value lands. */
  rolling?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/** Pip layout per face. Six-sided dice get real pips; anything else shows a numeral. */
const PIPS: Record<number, readonly [number, number][]> = {
  1: [[1, 1]],
  2: [
    [0, 0],
    [2, 2],
  ],
  3: [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  4: [
    [0, 0],
    [2, 0],
    [0, 2],
    [2, 2],
  ],
  5: [
    [0, 0],
    [2, 0],
    [1, 1],
    [0, 2],
    [2, 2],
  ],
  6: [
    [0, 0],
    [2, 0],
    [0, 1],
    [2, 1],
    [0, 2],
    [2, 2],
  ],
};

const SIZE = { sm: 'size-8 p-1', md: 'size-12 p-1.5', lg: 'size-16 p-2' } as const;

export function DiceFace({ value, sides = 6, rolling = false, size = 'md' }: DiceFaceProps) {
  const pips = sides === 6 ? PIPS[value] : undefined;

  return (
    <div
      role="img"
      aria-label={rolling ? 'Rolling' : `${value} of ${sides}`}
      className={[
        'rounded-lg border-2 border-border bg-surface text-ink shadow-sm',
        rolling ? 'animate-pulse' : '',
        SIZE[size],
      ].join(' ')}
    >
      {pips ? (
        <div className="grid size-full grid-cols-3 grid-rows-3">
          {Array.from({ length: 9 }, (_, i) => {
            const col = i % 3;
            const row = Math.floor(i / 3);
            const filled = pips.some(([px, py]) => px === col && py === row);
            return (
              <span key={i} className="grid place-items-center">
                {filled ? <span className="size-1.5 rounded-full bg-ink" /> : null}
              </span>
            );
          })}
        </div>
      ) : (
        <span className="grid size-full place-items-center font-mono text-xl">{value}</span>
      )}
    </div>
  );
}
