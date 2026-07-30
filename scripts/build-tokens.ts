/**
 * Generates `apps/web/src/design/tokens.css` from `tokens.ts`.
 *
 * The output is committed. It has to be: Tailwind reads CSS, and anything
 * inspecting this repo (including the design-system preview bundle) reads files
 * on disk, not the result of a build someone may not have run. CI regenerates
 * and fails on a dirty tree, so the committed copy can never drift.
 *
 * Two Tailwind v4 specifics drive the layout of the output:
 *
 *  1. Utilities are generated from `@theme` only. A custom property declared in
 *     a plain `:root` block is just a variable — no `bg-accent` class comes out
 *     of it. So the *light* semantic values live in `@theme` (which is what
 *     mints the classes) and the dark theme re-declares the same properties
 *     further down. Because the generated utilities resolve `var(--color-…)` at
 *     use time, they follow the override automatically.
 *  2. The numeric spacing scale is computed from a single `--spacing` base step,
 *     not from individually declared `--spacing-4`-style keys. Only genuinely
 *     named steps (`touch`) are declared explicitly.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  duration,
  fontFamily,
  fontSize,
  fontWeight,
  minTouchTarget,
  palette,
  playerColors,
  radius,
  semanticDark,
  semanticLight,
  shadow,
} from '../apps/web/src/design/tokens.ts';

const OUT = fileURLToPath(new URL('../apps/web/src/design/tokens.css', import.meta.url));

const vars = (entries: Record<string, string>, prefix: string, indent = '  '): string =>
  Object.entries(entries)
    .map(([key, value]) => `${indent}--${prefix}-${key}: ${value};`)
    .join('\n');

const playerVars = (indent: string): string =>
  playerColors
    .map((player, index) => `${indent}--color-player-${index}: ${player.hex};`)
    .join('\n');

const css = `/*
 * GENERATED FILE — DO NOT EDIT.
 * Source: apps/web/src/design/tokens.ts
 * Regenerate: pnpm tokens:build
 *
 * Values are PROVISIONAL placeholders pending the design pass. See tokens.ts.
 */

@import 'tailwindcss';

@theme {
  /* --- palette ramp ------------------------------------------------------ */
${vars(palette, 'color')}

  /* --- semantic colours (light; dark overrides below) -------------------- */
${vars(semanticLight, 'color')}

  /* --- player colours ----------------------------------------------------
     Okabe-Ito derived, chosen to stay distinguishable under protanopia,
     deuteranopia and tritanopia. Each is paired with a hatch pattern in
     design/patterns.ts so colour is never the only signal. */
${playerVars('  ')}

  /* --- type -------------------------------------------------------------- */
  --font-sans: ${fontFamily.sans};
  --font-mono: ${fontFamily.mono};

${vars(fontSize, 'text')}

${vars(fontWeight, 'font-weight')}

  /* --- space, radius, elevation ------------------------------------------ */
  /* Tailwind v4 derives the whole numeric scale (p-1, gap-6, …) from this. */
  --spacing: 0.25rem;
  /* Minimum comfortable touch target — phone-first, one-handed reach. */
  --spacing-touch: ${minTouchTarget};

${vars(radius, 'radius')}

${vars(shadow, 'shadow')}

  /* --- motion ------------------------------------------------------------ */
${vars(duration, 'duration')}
}

/* Dark theme re-declares the semantic properties; utilities follow along
   because they resolve their var() at use time. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
${vars(semanticDark, 'color', '    ')}
  }
}

:root[data-theme='dark'] {
${vars(semanticDark, 'color')}
}

/* Named motion utilities, so the duration tokens are usable as classes and can
   be zeroed in one place rather than component by component. */
${Object.keys(duration)
  .map(
    (key) =>
      `@utility duration-${key} {\n  transition-duration: var(--duration-${key});\n  animation-duration: var(--duration-${key});\n}`,
  )
  .join('\n\n')}

@utility min-h-touch {
  min-height: var(--spacing-touch);
}

@utility size-touch {
  width: var(--spacing-touch);
  height: var(--spacing-touch);
}

/* One global honouring of prefers-reduced-motion, rather than each component
   re-checking. Anything animating through the duration tokens stops here. */
@media (prefers-reduced-motion: reduce) {
  :root {
${Object.keys(duration)
  .map((key) => `    --duration-${key}: 0ms;`)
  .join('\n')}
  }

  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
`;

writeFileSync(OUT, css, 'utf8');
console.log(`tokens.css written (${css.length} bytes)`);
