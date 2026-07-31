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
const DOT_GAP = { sm: 'gap-0.5', md: 'gap-1', lg: 'gap-1' } as const;

function faceLabel(face: FallbackFace): string {
  return typeof face === 'number' ? `${face}` : `${face[0]}+${face[1]}`;
}

/** A run of small filled squares — a count, not a fixed shape (see FallbackFace). */
function BlobDots({ count, size }: { count: number; size: 'sm' | 'md' | 'lg' }) {
  const dot = size === 'sm' ? 'size-1' : 'size-1.5';
  return (
    <span className={['flex', DOT_GAP[size]].join(' ')}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={[dot, 'rounded-sm bg-ink'].join(' ')} />
      ))}
    </span>
  );
}

export function DiceFace({ face, rolling = false, size = 'md' }: DiceFaceProps) {
  return (
    <div
      role="img"
      aria-label={rolling ? 'Rolling' : `Fallback: ${faceLabel(face)}`}
      className={[
        'grid place-items-center rounded-lg border-2 border-border bg-surface text-ink shadow-sm',
        rolling ? 'animate-pulse' : '',
        SIZE[size],
      ].join(' ')}
    >
      {typeof face === 'number' ? (
        <BlobDots count={face} size={size} />
      ) : (
        <span className={['flex items-center', DOT_GAP[size]].join(' ')}>
          <BlobDots count={face[0]} size={size} />
          <span className="font-mono text-xs text-ink-muted">+</span>
          <BlobDots count={face[1]} size={size} />
        </span>
      )}
    </div>
  );
}
