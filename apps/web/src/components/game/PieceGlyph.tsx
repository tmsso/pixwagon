export interface PieceGlyphProps {
  /** Cell offsets making up the shape. Not required to be pre-normalized. */
  cells: readonly { x: number; y: number }[];
  cellSize?: number;
  label?: string;
}

/**
 * Renders one offered polyomino's footprint — a preview shell only. The
 * actual shape library (fixed pieces, rotation/mirroring, placement legality)
 * is Phase 1 game-core work (docs/mechanics-correction.md); this component
 * just draws whatever cell-offset list it's given.
 */
export function PieceGlyph({ cells, cellSize = 14, label }: PieceGlyphProps) {
  if (cells.length === 0) return null;

  const minX = Math.min(...cells.map((c) => c.x));
  const minY = Math.min(...cells.map((c) => c.y));
  const width = Math.max(...cells.map((c) => c.x - minX)) + 1;
  const height = Math.max(...cells.map((c) => c.y - minY)) + 1;
  const filled = new Set(cells.map((c) => `${c.x - minX},${c.y - minY}`));

  return (
    <div
      role="img"
      aria-label={label ?? `${cells.length}-cell piece`}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${width}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${height}, ${cellSize}px)`,
        gap: 2,
        lineHeight: 0,
      }}
    >
      {Array.from({ length: width * height }, (_, i) => {
        const x = i % width;
        const y = Math.floor(i / width);
        const isFilled = filled.has(`${x},${y}`);
        return (
          <span
            key={i}
            style={{
              width: cellSize,
              height: cellSize,
              background: isFilled ? 'var(--color-accent)' : 'transparent',
              borderRadius: 2,
            }}
          />
        );
      })}
    </div>
  );
}
