/* Original geometric outline icons for the PWA surfaces (design pass 02,
   Annotations 16–17): 24px viewBox, 1.7px stroke, square caps, currentColor,
   no fill. Path data lifted from the handoff's inline `<symbol>` defs
   (#ic-install, #ic-offline, #ic-refresh). Same house style as
   PlacementEditor.tsx's Turn/Flip/Take-back set. */

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

/** Install — a downward arrow into a baseline (add to home screen). */
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
