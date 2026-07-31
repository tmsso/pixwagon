# Design-sync notes

## Shape: custom-static-cards, not storybook/package

Pixwagon deliberately skipped the generic `/design-sync` skill's storybook/package
converter pipeline. That pipeline expects a publishable component library (a
`dist/` build + `.d.ts` exports) so Claude Design gets a live, importable React
bundle it can compose. `apps/web` is a Vite **app**, not a library — there is no
`main`/`exports` entry point, and building one would mean standing up new package
infrastructure (e.g. a `packages/ui` workspace member) that no roadmap phase
currently calls for.

Instead, this repo ships `design-system/`: 17 fully self-contained, standalone
preview-card HTML files (Tailwind compiled inline, no external stylesheet
dependency), generated from the _real_ components in
`apps/web/src/components/{ui,game}/` by `scripts/build-design-system.tsx`
(`pnpm design:build`), and verified locally by `pnpm design:check`. Each file
already carries the `<!-- @dsCard group="…" name="…" subtitle="…" width="…"
height="…" -->` marker the claude.ai/design self-check reads, so no
`register_assets` call was needed.

**Why**: for a one-time Phase 0.5 design interlude (produce six annotated
surfaces, hand back via the Handoff button, then hand-implement in Phase 2 as
code) the payoff of live component composability didn't justify the hours of
build/render-check/author/grade work, the new package infra, or the ongoing
maintenance surface of keeping a second build in sync. Revisit the live-bundle
path later if Claude Design becomes a recurring, iterative tool rather than a
single pass — see `docs/design/README.md` for the fuller writeup of what
`/design-sync` actually does vs. what `docs/architecture.md` §10 assumed.

## What was uploaded

The entire `design-system/` tree (`foundations/**`, `components/**`,
`manifest.json`, `README.md`) as a flat, one-shot upload into a freshly created
project — no `_ds_bundle.js`, no `tokens/`/`fonts/`/`_vendor/`, no per-component
`.d.ts`/`.prompt.md`. Design gets visual fidelity (these are the real rendered
components) but not live composability.

## Re-sync risks

- **No `_ds_sync.json` anchor was written** — this upload didn't go through
  `package-build.mjs`/`resync.mjs`, so there are no source hashes to diff
  against. A future re-sync (after `pnpm design:build` picks up token or
  component changes) has no anchor to skip against: it will need a full
  re-upload of the whole `design-system/` tree, not an incremental diff. That's
  expected and correct for this shape, not a bug.
- If a re-sync is ever done via the _real_ converter (because we've decided to
  build the live bundle), treat it as a first-time import into this same
  project, not a resync — the shape is changing, not just the content.
- Card grouping/sizing metadata (`group`, `name`, `subtitle`, `width`, `height`
  on the `@dsCard` line) is inferred from the shape of the generic marker
  format and has now been exercised through a real upload for the first time —
  see `docs/design/README.md`'s "Known unknown" section for what to check if
  cards group, title, or size oddly in the Design System pane.
