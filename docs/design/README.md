# docs/design/

Where Claude Design output lands, and how the sync actually works.

## How `/design-sync` really behaves

`docs/architecture.md` §10 describes a two-way "pull into Design / push back after implementation" flow. The tool does not work that way, and knowing this up front saves a session spent looking for a pull that does not exist. What it actually does:

- It syncs a local component library into a Claude Design project of type **design system**. That type is **fixed at creation** — a regular Design project cannot be converted into one later, so create the right kind first.
- The unit of sync is a **standalone preview HTML file** per component, each opening with an `@dsCard` marker comment. Those markers build the card index in Design's Design System pane. That is what `design-system/` is, and what `pnpm design:build` generates.
- **It does not introspect a Tailwind config, a `tokens.ts`, or a `.tsx` component tree.** Nothing binds to a React component because it is a React component; it binds to a rendered preview card. A repo full of beautifully typed components with no previews syncs nothing useful.
- Every write method points **repo → Design**. The read methods exist for diffing. The **Design → repo** direction is the **Handoff button**, which opens a new Claude Code session preloaded with the design context — not a `/design-sync` pull.
- The sync self-checks its uploads, counting previews that render blank, render thin, or whose variants are byte-identical. `pnpm design:check` runs the same class of check locally so we find those before uploading, not after Design has generated six screens against an empty system.

`docs/architecture.md` is committed verbatim as the source design document and is deliberately **not** edited to reflect this. The correction lives here.

## The order of operations

1. `pnpm design:build` — regenerate the bundle from the component shells and tokens.
2. `pnpm design:check` — confirm every card renders with visibly distinct variants.
3. Create a **design-system**-type project in Claude Design.
4. `/design-sync` from a session on this repo to upload `design-system/`.
5. Generate the six surfaces (see `BRIEF.md`), refine, and annotate on canvas.
6. **Handoff button** back into a fresh Claude Code session.

## The habit that prevents drift

Sync is a **snapshot, not a live watch**. Any time `tokens.ts` or a component shell changes — which they will, as `game-core` and the board firm up — re-run `pnpm design:build` and re-sync. Same discipline as regenerating types after a schema change. Stale sync means Design generating against old tokens.

## Fallback

If the beta features are not available on the account, use Claude Design's **Export → "Hand off to Claude Code"** bundle. It drops into this directory in one step, without the token sync. In that mode `docs/contracts/design-tokens.md` is the manual source of truth, reconciled once at implementation.

## What goes in this directory

Design output: exported screens, annotation notes, and any spec the implementation phases should follow. Nothing here is generated, so it is safe to hand-edit — unlike `design-system/`, which is regenerated wholesale.
