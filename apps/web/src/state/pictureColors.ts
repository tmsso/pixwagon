import { getPack } from '@pixwagon/packs';

/**
 * The picture's own colour for every board square, row-major like
 * `Board.cells` (`null` outside the picture) — what a filled square shows
 * since pass 04 (D19: filling reveals the picture). Cached per picture: the
 * board redraws on every pointer move and this never changes.
 */
const cache = new Map<string, readonly (string | null)[]>();

export function pictureFillColors(
  packId: string,
  pictureId: string,
): readonly (string | null)[] | undefined {
  const key = `${packId}/${pictureId}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const picture = getPack(packId)?.pictures.find((p) => p.id === pictureId);
  if (!picture) return undefined;
  const colors = picture.rows.flatMap((row) =>
    Array.from(row).map((char) =>
      char === '.' ? null : (picture.palette[Number(char)]?.hex ?? null),
    ),
  );
  cache.set(key, colors);
  return colors;
}

/** Perceived lightness, 0–255 (Rec. 601 weights). Above 200 a swatch is
 *  "light" and its hatch is drawn in ink instead of white (handoff-04). */
export function luma(hex: string): number {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? [...value].map((c) => c + c).join('') : value;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
