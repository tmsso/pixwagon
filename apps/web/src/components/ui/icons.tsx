/* Original geometric outline icons (design pass 02, Annotations 16–17; pass
   03): 24px viewBox, 1.7px stroke, square caps, currentColor, no fill. Path
   data lifted from the handoffs' inline SVG (pass 02's `<symbol>` defs; pass
   03's `source/*.dc.html`). Same house style as PlacementEditor.tsx's
   Turn/Flip/Take-back set. Lived in `pwa/` until pass 03 gave the room
   screens icons of their own. */

interface IconProps {
  /** Rendered px size; the design uses 14–24 across the surfaces. */
  size?: number;
}

function base(size: number) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'square' as const,
    'aria-hidden': true,
  };
}

/** Install — a downward arrow into a baseline (add to home screen). Also
 *  pass 03 `02g2`'s "this room needs an update" icon: same path. */
export function InstallIcon({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 3v11" />
      <path d="M7 10l5 5 5-5" />
      <path d="M4 19h16" />
    </svg>
  );
}

/** Offline — a crossed-out signal. */
export function OfflineIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M3 3l18 18" />
      <path d="M5 12a10 10 0 0 1 5-2.6" />
      <path d="M8.5 15.5a5 5 0 0 1 2.3-1.3" />
      <path d="M12 19h.01" />
    </svg>
  );
}

/** Refresh — a circular arrow (new version ready). */
export function RefreshIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M20 12a8 8 0 1 1-2.4-5.7" />
      <path d="M20 4v5h-5" />
    </svg>
  );
}

/** Link — two chain halves (pass 03 `02c`, Copy link). */
export function LinkIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M10 14l4-4" />
      <path d="M8.5 11.5L6 14a3 3 0 0 0 4 4l2.5-2.5" />
      <path d="M15.5 12.5L18 10a3 3 0 0 0-4-4l-2.5 2.5" />
    </svg>
  );
}

/** Tick (pass 03 `02d` "Link copied", `02h` the chosen pack). */
export function TickIcon({ size = 16, strokeWidth = 1.7 }: IconProps & { strokeWidth?: number }) {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth}>
      <path d="M5 12l4 4 10-10" />
    </svg>
  );
}

/** Pencil — "the host changed this" (pass 03 `02i`). */
export function PencilIcon({ size = 14 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={1.8}>
      <path d="M4 20h4l11-11-4-4L4 16v4z" />
    </svg>
  );
}

/** Seats — two rows of three: the room is full (pass 03 `02g1`). */
export function SeatsIcon({ size = 28 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="3" y="5" width="5" height="5" />
      <rect x="9.5" y="5" width="5" height="5" />
      <rect x="16" y="5" width="5" height="5" />
      <rect x="3" y="14" width="5" height="5" />
      <rect x="9.5" y="14" width="5" height="5" />
      <rect x="16" y="14" width="5" height="5" />
    </svg>
  );
}

/** Two windows — open in another tab (pass 03 `02g3`, D6). */
export function WindowsIcon({ size = 28 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="3" y="8" width="13" height="11" />
      <path d="M7 8V5h14v11h-5" />
    </svg>
  );
}

/** Back — a left chevron (pass 03 `06a` header). */
export function BackIcon({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M14 5l-7 7 7 7" />
    </svg>
  );
}

/** Placing — three dots: this player still owes the round (pass 03 `PlayerChip`
 *  status). Filled squares, not strokes: at 13 px an outline would blur. */
export function DotsIcon({ size = 13 }: IconProps) {
  return (
    <svg {...base(size)} fill="currentColor" stroke="none">
      <rect x="3" y="10.5" width="3.5" height="3.5" />
      <rect x="10.25" y="10.5" width="3.5" height="3.5" />
      <rect x="17.5" y="10.5" width="3.5" height="3.5" />
    </svg>
  );
}

/** Finished — four squares: this picture is complete. */
export function SquaresIcon({ size = 13 }: IconProps) {
  return (
    <svg {...base(size)} fill="currentColor" stroke="none">
      <rect x="4" y="4" width="7" height="7" />
      <rect x="13" y="4" width="7" height="7" />
      <rect x="4" y="13" width="7" height="7" />
      <rect x="13" y="13" width="7" height="7" />
    </svg>
  );
}

/** Away — a broken link: the connection dropped, the seat is kept. */
export function BrokenLinkIcon({ size = 13 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={2}>
      <path d="M9 15l-1.5 1.5a3 3 0 0 1-4-4L5 11" />
      <path d="M15 9l1.5-1.5a3 3 0 0 1 4 4L19 13" />
      <path d="M4 4l16 16" />
    </svg>
  );
}

/** Arrow — "the room moved on" (pass 03 `12e`, the skipped player's notice). */
export function ArrowIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M5 12h12" />
      <path d="M13 7l5 5-5 5" />
    </svg>
  );
}
