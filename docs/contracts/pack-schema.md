# Contract: shape-pack schema

**Implemented by** `packages/packs/src/schema.ts` · **Data** `packages/packs/data/*.json` · **Locked by** `schema.test.ts`

Freezing this early is what unblocks parallel work: packs, the renderer and the rules engine can all be built against it at once.

## The constraint it serves

`docs/architecture.md` §2.4 — packs are **data, not code**. Adding a theme must mean adding a file and nothing else. Phase 8 exists to test whether that actually held.

## Shape

```jsonc
{
  "schemaVersion": 1, // bumped when the *schema* changes; old packs fail loudly
  "id": "transportation", // lowercase kebab
  "name": "Transportation",
  "description": "…",
  "version": 1, // bumped when *pictures* change; for cache busting
  "pictures": [
    {
      "id": "tram",
      "name": "Tram",
      "difficulty": "easy", // easy | medium | hard
      "palette": [{ "name": "Body", "hex": "#d4483b" }],
      "rows": [".0000.", "011110"],
    },
  ],
}
```

## Why pixel rows are strings

`"..1112....."` is reviewable in a pull-request diff — you can see the picture in the source. `[0,0,1,1,1,2,...]` is not. Packs are hand-authored and reviewed far more often than they are parsed, so readability at authoring time beats parse convenience.

`.` means "not part of the picture, never fillable". A digit indexes into that picture's own palette.

## Why the palette is per picture, not per pack

A tram's body red and a balloon's envelope orange are both "index 0" in their own picture. Sharing one pack-level palette would force unrelated pictures into the same colours or force a wider indirection. Per-picture palettes keep each picture self-contained, which is the same reason packs are self-contained.

Player colours are **not** in here — they are design tokens (`apps/web/src/design/tokens.ts`), because they identify a person, not a picture.

## Validation

`parsePack()` enforces, beyond the type shape:

- every row is the same width (rectangular grid), naming the offending row index;
- every palette index referenced actually exists;
- the picture has at least one fillable cell.

It throws a readable multi-line error rather than a raw ZodError. Packs are parsed **at module load**, deliberately: a malformed pack should fail at startup, not halfway through someone's game.

## Not yet decided

- Whether a picture can declare a required fill _order_ or region grouping. Phase 1 will discover whether the rules need it.
- Pack-level difficulty versus per-picture difficulty. Currently per-picture only.
