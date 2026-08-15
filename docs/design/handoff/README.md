# Design handoff — 2026-08-09

Output of the Phase 0.5 design pass (`docs/design/BRIEF.md`), landed here per the
Handoff-button fallback described in `docs/design/README.md`.

- `chats/` — the Claude Design conversation transcripts (`DiceFace formatting
revision`, `Commit changes`). They record the reasoning behind the changes
  below; read them before touching this handoff further.
- `github.md` — the sync record Claude Design kept of what it pulled from and
  proposed back to this repo.
- `../surfaces/` — the six-surface annotated canvas
  (`Pixwagon - six surfaces.html`, its stylesheet, and `render-pictures.js`,
  which draws the real transportation-pack pictures into the mockup). This is
  a static HTML/CSS/JS prototype, not app code — see `docs/design/README.md`
  for why `/design-sync` works this way.

## What was implemented from this handoff

- `DiceFace.tsx`: combination faces (`1+2`, `2+2`, `1+3`) now stack their two
  blobs on separate lines with a hairline `border-border` rule between them,
  replacing the inline `blob + blob` row and the `+` glyph. `design-system/`
  regenerated to match (`pnpm design:build`).

## What was not implemented

Building the six surfaces themselves out as real routes (`HomeScreen.tsx`,
`LobbyScreen.tsx`, etc., currently Phase 0 placeholders per
`ScaffoldNotice.tsx`) is explicitly **Phase 2** work in `ROADMAP.md`
("Real screens replacing the Phase 0 placeholders, built from the design
handoff"), bundled with the canvas board renderer, input handling, and a
client-state-store decision that haven't happened yet. This handoff lands the
design reference and the one already-specified code change (`DiceFace`); the
route implementation itself is left for Phase 2 so it isn't started ahead of
its prerequisites.
