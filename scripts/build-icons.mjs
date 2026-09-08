/**
 * Rasterises the app mark to the PNG sizes a PWA install needs.
 *
 * Why hand-rolled: the mark (`apps/web/public/icon.svg`) is a rounded teal
 * square plus five light squares — solid-colour, axis-aligned rectangles only.
 * That is the one shape a from-scratch PNG encoder handles in a few lines, so we
 * avoid a native rasteriser dependency (sharp / resvg) on a memory-constrained
 * machine and its `minimumReleaseAge` / `allowBuilds` paperwork.
 *
 * NOT wired into `generated:check`: `deflateSync` output can differ byte-for-byte
 * across zlib builds, which would make the drift check flaky in CI. The PNGs are
 * committed as ordinary assets. Re-run this by hand (`node scripts/build-icons.mjs`)
 * whenever `icon.svg` changes, and commit the result.
 *
 *   Design source: docs/design/handoff-02 Annotation 17 (splash uses the same
 *   mark) and the existing icon.svg geometry.
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The mark, in a 64-unit viewBox — identical to icon.svg.
const VIEW = 64;
const BG = [0x2a, 0x9d, 0x8a]; // --accent
const FG = [0xf6, 0xf7, 0xf9]; // --bg
const CORNER_RADIUS = 12;
const PIXELS = [
  [14, 14],
  [26, 26],
  [38, 14],
  [14, 38],
  [38, 38],
];
const PIXEL_SIZE = 12;

/** CRC-32 as PNG chunks need it — table-driven, matching zlib. */
function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBytes, data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), out.length - 4);
  return out;
}

/**
 * True for pixels outside the rounded-corner arc, so they render transparent.
 * A pixel is clipped when it sits in a corner's r×r box (within `r` of two
 * adjacent edges) and is further than `r` from that corner's arc centre.
 */
function outsideRoundedCorner(x, y, size) {
  const r = (CORNER_RADIUS / VIEW) * size;
  const cx = x < r ? r : x > size - r ? size - r : null;
  const cy = y < r ? r : y > size - r ? size - r : null;
  if (cx === null || cy === null) return false; // not in a corner box
  return Math.hypot(x - cx, y - cy) > r;
}

function renderRGBA(size) {
  const scale = size / VIEW;
  const data = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      if (outsideRoundedCorner(x + 0.5, y + 0.5, size)) {
        data[i + 3] = 0; // transparent corner
        continue;
      }
      let colour = BG;
      const ux = x / scale;
      const uy = y / scale;
      for (const [px, py] of PIXELS) {
        if (ux >= px && ux < px + PIXEL_SIZE && uy >= py && uy < py + PIXEL_SIZE) {
          colour = FG;
          break;
        }
      }
      data[i] = colour[0];
      data[i + 1] = colour[1];
      data[i + 2] = colour[2];
      data[i + 3] = 0xff;
    }
  }
  return data;
}

function encodePNG(size) {
  const rgba = renderRGBA(size);
  // One filter byte (0 = None) per scanline, then the row's RGBA bytes.
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const here = fileURLToPath(new URL('.', import.meta.url));
for (const size of [192, 512]) {
  const path = `${here}../apps/web/public/icon-${size}.png`;
  writeFileSync(path, encodePNG(size));
  console.log(`icon-${size}.png written`);
}
