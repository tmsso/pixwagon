export interface PicturePreviewProps {
  rows: readonly string[];
  palette: readonly { name: string; hex: string }[];
  cellSize?: number;
  /** Show the target picture in colour, or as the empty grid the player starts from. */
  mode?: 'target' | 'outline';
  label?: string;
}

/**
 * Renders a pack picture straight from its `rows` strings.
 *
 * Worth having as its own component: it is used on the pack picker, the results
 * screen and the daily-puzzle card, and it is the thing that proves the pack
 * data format actually reaches the UI without an intermediate build step.
 */
export function PicturePreview({
  rows,
  palette,
  cellSize = 8,
  mode = 'target',
  label,
}: PicturePreviewProps) {
  const width = rows[0]?.length ?? 0;

  return (
    <div
      role="img"
      aria-label={label ?? 'Picture preview'}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${width}, ${cellSize}px)`,
        width: 'max-content',
        lineHeight: 0,
      }}
    >
      {rows.flatMap((row, y) =>
        Array.from(row).map((char, x) => {
          const blank = char === '.';
          const swatch = blank ? undefined : palette[Number(char)];
          const background =
            blank || mode === 'outline'
              ? 'var(--color-cell-blank)'
              : (swatch?.hex ?? 'var(--color-cell-fillable)');

          return (
            <span
              key={`${x}-${y}`}
              style={{
                width: cellSize,
                height: cellSize,
                background,
                // Outline mode shows the player what they have to fill, without
                // giving away the colours.
                outline:
                  mode === 'outline' && !blank ? '1px solid var(--color-cell-fillable)' : undefined,
                outlineOffset: '-1px',
              }}
            />
          );
        }),
      )}
    </div>
  );
}
