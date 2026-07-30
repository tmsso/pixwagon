/**
 * Fails if regenerating the given paths changed anything in the working tree.
 *
 * Uses `git status --porcelain`, not `git diff --exit-code`. The difference
 * matters: `git diff` compares tracked files only, so a *newly generated* file
 * that was never committed is untracked, produces no diff, and sails through.
 * That is the exact case this check exists to catch — someone adds a card to
 * `cards.tsx`, forgets to commit the generated preview, and CI stays green while
 * the design system Claude Design reads is missing a component.
 *
 * `--porcelain` reports untracked, modified and deleted alike.
 */

import { execFileSync } from 'node:child_process';

const paths = process.argv.slice(2);
if (paths.length === 0) {
  console.error('usage: assert-clean.mjs <path> [path...]');
  process.exit(2);
}

const output = execFileSync(
  'git',
  ['status', '--porcelain', '--untracked-files=all', '--', ...paths],
  { encoding: 'utf8' },
).trim();

if (output === '') {
  console.log(`generated files are in sync (${paths.join(', ')})`);
  process.exit(0);
}

console.error('Generated files differ from what is committed:\n');
console.error(output);
console.error(
  '\nRun `pnpm tokens:build && pnpm design:build` and commit the result.\n' +
    'Status codes: ?? = generated but never committed, M = changed, D = deleted.',
);
process.exit(1);
