/**
 * Generates the `design-system/` preview bundle from the component shells.
 *
 * This is the artifact `/design-sync` uploads to a Claude Design design-system
 * project. Design binds to *preview cards*, not to `.tsx` files — so a repo full
 * of beautifully typed components with no previews syncs nothing useful.
 *
 * Generated rather than hand-written on purpose: the previews and the components
 * they document cannot drift, because there is one source. Re-running this after
 * any component or token change is the anti-drift habit architecture.md §10 asks
 * for, made mechanical.
 *
 * The CSS comes from the web app's own production build, so a preview is styled
 * by exactly the stylesheet the app ships — not an approximation of it.
 */

import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { cards } from './design-system/cards.tsx';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT_DIR = join(ROOT, 'design-system');
const WEB_DIST_ASSETS = join(ROOT, 'apps/web/dist/assets');

function readBuiltCss(): string {
  let files: string[];
  try {
    files = readdirSync(WEB_DIST_ASSETS).filter((file) => file.endsWith('.css'));
  } catch {
    throw new Error(
      `No built CSS at ${WEB_DIST_ASSETS}.\nRun \`pnpm --filter @pixwagon/web build\` first (the design:build script does this for you).`,
    );
  }
  if (files.length === 0) throw new Error(`No .css file found in ${WEB_DIST_ASSETS}`);
  return files.map((file) => readFileSync(join(WEB_DIST_ASSETS, file), 'utf8')).join('\n');
}

const css = readBuiltCss();

function page(card: (typeof cards)[number], body: string): string {
  // The @dsCard marker must be the very first line — that is what Design reads
  // to index the card into its Design System pane.
  return `<!-- @dsCard group="${card.group}" name="${card.name}" subtitle="${card.subtitle}" width="${card.viewport.width}"${card.viewport.height ? ` height="${card.viewport.height}"` : ''} -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${card.name} — Pixwagon design system</title>
    <style>
${css}
    </style>
  </head>
  <body class="bg-bg text-ink" style="margin:0">
    <div style="padding:24px">
      <header style="margin-bottom:20px">
        <h1 class="text-xl font-semibold">${card.name}</h1>
        <p class="text-sm text-ink-muted">${card.subtitle}</p>
      </header>
      ${body}
    </div>
  </body>
</html>
`;
}

rmSync(OUT_DIR, { recursive: true, force: true });

const manifest = cards.map((card) => {
  const body = renderToStaticMarkup(card.render());
  const target = join(OUT_DIR, card.path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, page(card, body), 'utf8');
  return {
    name: card.name,
    path: card.path,
    group: card.group,
    subtitle: card.subtitle,
    viewport: card.viewport,
  };
});

writeFileSync(
  join(OUT_DIR, 'manifest.json'),
  `${JSON.stringify({ generatedFrom: 'scripts/design-system/cards.tsx', cards: manifest }, null, 2)}\n`,
  'utf8',
);

writeFileSync(
  join(OUT_DIR, 'README.md'),
  `# design-system/ — GENERATED, DO NOT EDIT

Regenerate with \`pnpm design:build\`. Source: \`scripts/design-system/cards.tsx\`.

This is the Pixwagon design system as Claude Design consumes it: one standalone,
self-contained preview page per card, each opening with an \`@dsCard\` marker that
Design reads to build its Design System pane. Styling is inlined from the web
app's own production stylesheet, so a card is styled by exactly what ships.

Upload it with \`/design-sync\` against a project of type *design system* — that
type is fixed at creation, so a regular Design project cannot be converted into
one later.

${manifest.length} cards across groups: ${[...new Set(manifest.map((c) => c.group))].join(', ')}.
`,
  'utf8',
);

console.log(`design-system: ${manifest.length} cards written to design-system/`);
