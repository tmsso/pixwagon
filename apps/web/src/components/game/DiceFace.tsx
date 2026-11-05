/**
 * A bare number is one blob of that many cells; a tuple is two independent
 * blobs (mechanics-correction.md's fallback-die faces: 1 / 2 / 3 / 1+2 / 2+2 / 1+3).
 * The die shows *how many* cells per blob, never a fixed shape — the player
 * chooses the actual contiguous cells at placement time.
 */
export type FallbackFace = 1 | 2 | 3 | readonly [number, number];

export interface DiceFaceProps {
  face: FallbackFace;
  /** Mid-roll shimmer, before the referee's value lands. */
  rolling?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE = { sm: 'size-8 p-1', md: 'size-12 p-1.5', lg: 'size-16 p-2' } as const;
const DOT_GAP = { sm: 'gap-0.5', md: 'gap-1', lg: 'gap-1.5' } as const;

function faceLabel(face: FallbackFace): string {
  return typeof face === 'number' ? `${face}` : `${face[0]}+${face[1]}`;
}

/**
 * A blob as one connected run of squares, touching like a piece's cells do in
 * `PieceGlyph` — a count, not a fixed shape (see FallbackFace). Pass 04: this
 * used to be a row of separated round dots, so a `2` read as "two 1×1 squares"
 * when it means one connected group of two (the owner's "doesn't fit" report).
 */
function BlobRun({ count, size }: { count: number; size: 'sm' | 'md' | 'lg' }) {
  const cell = RUN_CELL[size];
  return (
    <span className="flex gap-px">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={[cell, 'rounded-[1px] bg-ink'].join(' ')} />
      ))}
    </span>
  );
}

const RUN_CELL = { sm: 'size-1.5', md: 'size-2.5', lg: 'size-3' } as const;

export function DiceFace({ face, rolling = false, size = 'md' }: DiceFaceProps) {
  return (
    <div
      role="img"
      aria-label={rolling ? 'Rolling' : `The single, ${faceLabel(face)}`}
      className={[
        'grid place-items-center rounded-lg border-2 border-border bg-surface text-ink shadow-sm',
        rolling ? 'animate-pulse' : '',
        SIZE[size],
      ].join(' ')}
    >
      {typeof face === 'number' ? (
        <BlobRun count={face} size={size} />
      ) : (
        <span className={['flex flex-col items-center', DOT_GAP[size]].join(' ')}>
          <BlobRun count={face[0]} size={size} />
          <span className="h-px w-full bg-border" />
          <BlobRun count={face[1]} size={size} />
        </span>
      )}
    </div>
  );
}
