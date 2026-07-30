import { z } from 'zod';

/**
 * Shape-pack schema — the first of the four contracts in architecture.md §6.
 *
 * The constraint this serves (§2.4): a pack is *data*, not code. Shipping a new
 * theme must mean adding a file here and nothing else — no engine change, no
 * renderer change. Phase 8 exists specifically to test whether that held.
 *
 * Design choice worth explaining: pixel rows are **strings**, not arrays of
 * integers. `"..1112....."` is reviewable in a pull-request diff — you can see
 * the picture in the source. `[0,0,1,1,1,2,0,...]` is not. Since packs are
 * hand-authored and reviewed far more often than they are parsed, readability at
 * authoring time beats parse convenience.
 */

const HEX = /^#[0-9a-fA-F]{6}$/;
/** '.' = not part of the picture. '0'-'9' index into the picture's own palette. */
const PIXEL_ROW = /^[.0-9]+$/;

export const swatchSchema = z.object({
  name: z.string().min(1),
  hex: z.string().regex(HEX, 'expected a 6-digit hex colour like #1b7f5a'),
});

export const difficultySchema = z.enum(['easy', 'medium', 'hard']);

export const pictureSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/, 'picture ids are lowercase kebab-case'),
    name: z.string().min(1),
    difficulty: difficultySchema,
    /** Each picture carries its own palette so themes stay self-contained. */
    palette: z.array(swatchSchema).min(1).max(10),
    rows: z.array(z.string().regex(PIXEL_ROW)).min(1),
  })
  .superRefine((picture, ctx) => {
    const width = picture.rows[0]?.length ?? 0;

    picture.rows.forEach((row, y) => {
      if (row.length !== width) {
        ctx.addIssue({
          code: 'custom',
          path: ['rows', y],
          message: `row ${y} is ${row.length} wide, expected ${width} — the grid must be rectangular`,
        });
      }
      for (const char of row) {
        if (char === '.') continue;
        const index = Number(char);
        if (index >= picture.palette.length) {
          ctx.addIssue({
            code: 'custom',
            path: ['rows', y],
            message: `row ${y} references palette index ${index}, but the palette has ${picture.palette.length} entries`,
          });
          break;
        }
      }
    });

    const fillable = picture.rows.join('').replace(/\./g, '').length;
    if (fillable === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['rows'],
        message: 'picture has no fillable cells',
      });
    }
  });

export const packSchema = z.object({
  /** Bumped when the *schema* changes shape, so old packs fail loudly. */
  schemaVersion: z.literal(1),
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  description: z.string().min(1),
  /** Pack content version — bump when pictures change, for cache busting. */
  version: z.number().int().positive(),
  pictures: z.array(pictureSchema).min(1),
});

export type Swatch = z.infer<typeof swatchSchema>;
export type Difficulty = z.infer<typeof difficultySchema>;
export type Picture = z.infer<typeof pictureSchema>;
export type Pack = z.infer<typeof packSchema>;

/** Parses and validates a pack, throwing a readable error rather than a ZodError dump. */
export function parsePack(input: unknown): Pack {
  const result = packSchema.safeParse(input);
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid shape pack:\n${detail}`);
  }
  return result.data;
}

/** Derived helpers the renderer and game-core both want. */
export function pictureSize(picture: Picture): { width: number; height: number } {
  return { width: picture.rows[0]?.length ?? 0, height: picture.rows.length };
}

export function fillableCellCount(picture: Picture): number {
  return picture.rows.join('').replace(/\./g, '').length;
}
