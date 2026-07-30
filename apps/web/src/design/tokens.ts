/**
 * Design tokens — the fourth contract in architecture.md §6, and the artifact
 * the design handoff binds to.
 *
 * ─── PROVISIONAL ────────────────────────────────────────────────────────────
 * Every value here is a placeholder chosen to be plausible and internally
 * consistent, NOT a considered visual identity. Their job is to give Claude
 * Design real token *names* to bind to so it never invents its own. Expect the
 * values to be replaced wholesale after the design pass; expect the names and
 * the shape of this file to survive.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * This file is the single source. `pnpm tokens:build` generates
 * `tokens.css` from it and `pnpm design:build` generates the preview cards from
 * it. Never hand-edit either output — CI regenerates both and fails if the tree
 * comes back dirty.
 *
 * Why TypeScript is the source rather than CSS: the board is a Canvas renderer.
 * `ctx.fillStyle` needs an actual colour string, and reading it back out of a
 * stylesheet at runtime via `getComputedStyle` would not work in tests or in the
 * Durable Object. CSS-only tokens would fail the single most important surface
 * in the app.
 */

// ---------------------------------------------------------------------------
// Palette ramp
// ---------------------------------------------------------------------------

export const palette = {
  'slate-50': '#f6f7f9',
  'slate-100': '#eaedf1',
  'slate-200': '#d3d9e0',
  'slate-300': '#adb7c2',
  'slate-400': '#7d8996',
  'slate-500': '#5a6673',
  'slate-600': '#434e59',
  'slate-700': '#333c45',
  'slate-800': '#232a31',
  'slate-900': '#171c21',
  'slate-950': '#0e1216',

  'wagon-300': '#8fd4c4',
  'wagon-400': '#4fb8a1',
  'wagon-500': '#2a9d8a',
  'wagon-600': '#1f7a6c',
  'wagon-700': '#175c51',

  'signal-400': '#f4a259',
  'signal-500': '#e8853a',
  'signal-600': '#c96a25',

  'danger-400': '#ef7a72',
  'danger-500': '#d64a3f',
  'danger-600': '#ad3428',
} as const;

// ---------------------------------------------------------------------------
// Semantic colours (light / dark pairs)
// ---------------------------------------------------------------------------

export const semanticLight = {
  bg: palette['slate-50'],
  surface: '#ffffff',
  'surface-sunken': palette['slate-100'],
  border: palette['slate-200'],
  ink: palette['slate-900'],
  'ink-muted': palette['slate-500'],
  'ink-inverted': '#ffffff',
  accent: palette['wagon-500'],
  'accent-hover': palette['wagon-600'],
  'accent-ink': '#ffffff',
  warning: palette['signal-500'],
  danger: palette['danger-500'],
  /** Board-specific: an unfilled but fillable cell. */
  'cell-fillable': palette['slate-200'],
  /** Board-specific: a cell that is not part of the picture. */
  'cell-blank': palette['slate-50'],
  'cell-locked': palette['slate-300'],
} as const;

export const semanticDark = {
  bg: palette['slate-950'],
  surface: palette['slate-900'],
  'surface-sunken': palette['slate-800'],
  border: palette['slate-700'],
  ink: palette['slate-50'],
  'ink-muted': palette['slate-400'],
  'ink-inverted': palette['slate-950'],
  accent: palette['wagon-400'],
  'accent-hover': palette['wagon-300'],
  'accent-ink': palette['slate-950'],
  warning: palette['signal-400'],
  danger: palette['danger-400'],
  'cell-fillable': palette['slate-700'],
  'cell-blank': palette['slate-900'],
  'cell-locked': palette['slate-600'],
} as const;

export type SemanticColorName = keyof typeof semanticLight;

// ---------------------------------------------------------------------------
// Player colours
// ---------------------------------------------------------------------------

/**
 * Derived from the Okabe–Ito qualitative palette, which was designed to stay
 * distinguishable under protanopia, deuteranopia and tritanopia. Picked here
 * rather than in the Phase 9 polish pass on purpose: player colour is the one
 * token a six-screen design will build layout and hierarchy around, and swapping
 * it late means redoing that work.
 *
 * `pattern` exists because colour must never be the *sole* signal. Each player
 * also gets a fill hatch, so two players remain tellable apart in a screenshot,
 * in greyscale, or by someone who sees no colour difference at all.
 */
export const playerColors = [
  { name: 'Cobalt', hex: '#0072b2', pattern: 'solid' },
  { name: 'Vermillion', hex: '#d55e00', pattern: 'diagonal' },
  { name: 'Teal', hex: '#009e73', pattern: 'dots' },
  { name: 'Amber', hex: '#e69f00', pattern: 'horizontal' },
  { name: 'Orchid', hex: '#cc79a7', pattern: 'cross' },
  { name: 'Sky', hex: '#56b4e9', pattern: 'vertical' },
] as const;

export type PlayerColor = (typeof playerColors)[number];
export type PlayerPattern = PlayerColor['pattern'];

/** Rooms cap at the number of distinct player colours we can guarantee. */
export const MAX_PLAYERS = playerColors.length;

export function playerColor(index: number): PlayerColor {
  // Non-null assertion is sound: modulo bounds the index into the array.
  return playerColors[index % playerColors.length]!;
}

// ---------------------------------------------------------------------------
// Type, space, radius, motion
// ---------------------------------------------------------------------------

export const fontFamily = {
  sans: "'Inter Variable', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  /** Room codes, dice values, scores — anything that must not shift width. */
  mono: "'JetBrains Mono Variable', ui-monospace, 'SF Mono', 'Cascadia Code', monospace",
} as const;

/** Fluid-ish scale, phone-first: the small end is the design target. */
export const fontSize = {
  xs: '0.75rem',
  sm: '0.875rem',
  base: '1rem',
  lg: '1.125rem',
  xl: '1.375rem',
  '2xl': '1.75rem',
  '3xl': '2.25rem',
  display: '3rem',
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

/** 4px base step. */
export const spacing = {
  '0': '0rem',
  '1': '0.25rem',
  '2': '0.5rem',
  '3': '0.75rem',
  '4': '1rem',
  '5': '1.25rem',
  '6': '1.5rem',
  '8': '2rem',
  '10': '2.5rem',
  '12': '3rem',
  '16': '4rem',
} as const;

export const radius = {
  none: '0rem',
  sm: '0.25rem',
  md: '0.5rem',
  lg: '0.875rem',
  xl: '1.25rem',
  full: '9999px',
} as const;

export const shadow = {
  sm: '0 1px 2px rgb(14 18 22 / 0.08)',
  md: '0 4px 12px rgb(14 18 22 / 0.10)',
  lg: '0 12px 32px rgb(14 18 22 / 0.16)',
} as const;

/**
 * Every animation must honour `prefers-reduced-motion`. Exposed as tokens so a
 * reduced-motion media query can zero them in one place rather than component
 * by component.
 */
export const duration = {
  instant: '0ms',
  fast: '120ms',
  normal: '200ms',
  slow: '360ms',
} as const;

/** Minimum comfortable touch target. Phone-first, one-handed reach (§7 phase 9). */
export const minTouchTarget = '2.75rem';
