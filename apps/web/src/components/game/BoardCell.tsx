import { patternStyle } from '../../design/patterns.ts';
import { playerColor } from '../../design/tokens.ts';

export type BoardCellState =
  | 'blank' // not part of the picture
  | 'fillable' // part of the picture, empty
  | 'candidate' // would be filled by the current combo — hover/press affordance
  | 'filled'
  | 'locked' // resolved, no longer changeable
  | 'invalid'; // rejected by the referee; shown briefly during rollback

export interface BoardCellProps {
  state: BoardCellState;
  /** Which player filled it. Ignored unless state is `filled`. */
  colorIndex?: number;
  size?: number;
}

/**
 * The DOM cell. Real boards render on Canvas for crisp scaling (architecture.md
 * §3), but this component is the authority on what each state *looks like* — the
 * Canvas renderer will mirror it. Keeping a DOM version also means the states
 * are inspectable, testable and previewable, which a canvas is not.
 */
export function BoardCell({ state, colorIndex = 0, size = 24 }: BoardCellProps) {
  const color = playerColor(colorIndex);

  const base = 'border transition-colors duration-fast';
  const byState: Record<BoardCellState, string> = {
    blank: 'bg-cell-blank border-transparent',
    fillable: 'bg-cell-fillable border-border',
    candidate: 'bg-cell-fillable border-accent border-2 border-dashed',
    filled: 'border-black/10',
    locked: 'bg-cell-locked border-border',
    invalid: 'bg-danger/20 border-danger border-2',
  };

  return (
    <span
      role="gridcell"
      aria-label={state}
      className={[base, byState[state]].join(' ')}
      style={{
        width: size,
        height: size,
        display: 'inline-block',
        ...(state === 'filled' ? patternStyle(color.pattern, color.hex) : {}),
      }}
    />
  );
}
