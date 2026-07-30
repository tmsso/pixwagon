/**
 * Render check for the design-system bundle.
 *
 * Claude Design's own sync self-check counts previews that are `bad` (render
 * nothing), `thin` (render almost nothing), or `variantsIdentical` (every
 * variant looks the same). A card that trips any of those uploads successfully
 * and teaches Design nothing — which is the failure mode this whole bundle
 * exists to avoid. Checking it here means we find out before the upload, not
 * after Design has generated six screens against an empty system.
 *
 * What this does and does not prove: it is a structural check on the generated
 * markup, not a pixel render in a browser. It catches empty cards, near-empty
 * cards, and variants that are byte-identical to each other. It would not catch
 * a card that renders plenty of markup in the wrong colour.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIR = join(ROOT, 'design-system');

/** Rendered content below this many characters is treated as nothing at all. */
const BAD_BELOW = 200;
/** Below this, a card technically renders but carries too little to be useful. */
const THIN_BELOW = 700;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith('.html') ? [full] : [];
  });
}

function bodyOf(html: string): string {
  return /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? '';
}

/** Markup of each `data-variant` block, so identical variants are detectable. */
function variantBlocks(body: string): string[] {
  const blocks: string[] = [];
  const re = /<div data-variant="([^"]*)"/g;
  let match: RegExpExecArray | null;
  const starts: number[] = [];
  while ((match = re.exec(body)) !== null) starts.push(match.index);
  starts.forEach((start, i) => {
    blocks.push(body.slice(start, starts[i + 1] ?? body.length));
  });
  return blocks;
}

interface Finding {
  path: string;
  contentLength: number;
  variants: number;
  status: 'ok' | 'thin' | 'bad';
  identicalVariants: boolean;
  hasDsCard: boolean;
}

const files = walk(DIR);
const findings: Finding[] = files.map((file) => {
  const html = readFileSync(file, 'utf8');
  const body = bodyOf(html);
  // Strip tags to measure actual rendered substance rather than markup volume —
  // a wall of empty <div>s should not count as content.
  const text = body
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const blocks = variantBlocks(body);
  const stripped = blocks.map((b) => b.replace(/data-variant="[^"]*"/, '').trim());

  return {
    path: relative(ROOT, file),
    contentLength: body.length,
    variants: blocks.length,
    status: body.length < BAD_BELOW ? 'bad' : body.length < THIN_BELOW ? 'thin' : 'ok',
    identicalVariants: stripped.length > 1 && new Set(stripped).size < stripped.length,
    hasDsCard: html.startsWith('<!-- @dsCard '),
    ...(text.length === 0 ? { status: 'bad' as const } : {}),
  };
});

const counts = {
  total: findings.length,
  bad: findings.filter((f) => f.status === 'bad').length,
  thin: findings.filter((f) => f.status === 'thin').length,
  variantsIdentical: findings.filter((f) => f.identicalVariants).length,
  missingDsCard: findings.filter((f) => !f.hasDsCard).length,
  iterations: 1,
};

writeFileSync(
  join(ROOT, '.render-check.json'),
  `${JSON.stringify({ counts, findings }, null, 2)}\n`,
  'utf8',
);

const problems = findings.filter((f) => f.status !== 'ok' || f.identicalVariants || !f.hasDsCard);

for (const problem of problems) {
  const reasons = [
    problem.status !== 'ok' ? problem.status : null,
    problem.identicalVariants ? 'identical variants' : null,
    !problem.hasDsCard ? 'missing @dsCard marker' : null,
  ].filter(Boolean);
  console.error(`✗ ${problem.path}: ${reasons.join(', ')} (${problem.contentLength} bytes)`);
}

console.log(
  `design-system render check: ${counts.total} cards, ${counts.bad} bad, ${counts.thin} thin, ${counts.variantsIdentical} with identical variants`,
);

if (problems.length > 0) {
  console.error('\nCards must render real, visibly distinct variants before syncing to Design.');
  process.exit(1);
}
