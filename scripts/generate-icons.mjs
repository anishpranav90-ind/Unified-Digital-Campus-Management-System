#!/usr/bin/env node
/**
 * Generates the UniSync app icons from a single vector description.
 *
 *   node scripts/generate-icons.mjs
 *
 * Outputs:
 *   src/app/icon.svg        vector favicon (crisp on high-density displays)
 *   src/app/favicon.ico     16, 32 and 48 px PNG entries for every browser
 *   src/app/apple-icon.png  180 px home-screen icon
 *
 * The mark is a rounded navy tile with an orange "U" stroke. Everything is
 * drawn here so the artwork has no external source and no binary dependencies.
 */

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const NAVY = [11, 31, 58];
const ORANGE = [249, 115, 22];

const UNIT = 64; // design grid
const U_TOP = 17;
const U_ARM = 32;
const U_CENTER = 32;
const U_RADIUS = 12;
const U_STROKE = 8;

/** Signed distance from a point to the U centreline, in design units. */
function distanceToU(x, y) {
  const dx = x - 32;
  const dy = y - U_CENTER;

  // Bottom arc: the half of the circle below its centre.
  const arcDistance =
    y >= U_CENTER ? Math.abs(Math.hypot(dx, dy) - U_RADIUS) : Math.hypot(Math.abs(dx) - U_RADIUS, dy);

  // Vertical arms, from the top of the glyph down to the arc start.
  const armX = U_RADIUS;
  const armDistance =
    y < U_ARM ? Math.hypot(Math.abs(dx) - armX, y < U_TOP ? U_TOP - y : 0) : Infinity;

  return Math.min(arcDistance, armDistance);
}

/** Rounded-square coverage for the tile background. */
function insideTile(x, y, radius) {
  const near = radius;
  const cx = Math.min(Math.max(x, near), UNIT - near);
  const cy = Math.min(Math.max(y, near), UNIT - near);
  const inCorner = (x < near || x > UNIT - near) && (y < near || y > UNIT - near);
  if (!inCorner) return x >= 0 && x <= UNIT && y >= 0 && y <= UNIT;
  return Math.hypot(x - cx, y - cy) <= near;
}

function render(size, { rounded }) {
  const scale = UNIT / size;
  const samples = 4;
  const pixels = Buffer.alloc(size * size * 4);
  const radius = rounded ? 14 : 0;

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let bgHits = 0;
      let fgHits = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const x = (px + (sx + 0.5) / samples) * scale;
          const y = (py + (sy + 0.5) / samples) * scale;
          if (!insideTile(x, y, radius)) continue;
          bgHits += 1;
          if (distanceToU(x, y) <= U_STROKE / 2) fgHits += 1;
        }
      }
      const total = samples * samples;
      const alpha = bgHits / total;
      const mix = fgHits / Math.max(bgHits, 1);
      const offset = (py * size + px) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        pixels[offset + channel] = Math.round(NAVY[channel] * (1 - mix) + ORANGE[channel] * mix);
      }
      pixels[offset + 3] = Math.round(alpha * 255);
    }
  }

  return encodePng(size, size, pixels);
}

// --- PNG ---------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // no filter
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- ICO ---------------------------------------------------------------------

function encodeIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const entries = [];
  let offset = 6 + images.length * 16;
  for (const image of images) {
    const entry = Buffer.alloc(16);
    entry[0] = image.size >= 256 ? 0 : image.size;
    entry[1] = image.size >= 256 ? 0 : image.size;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(image.png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += image.png.length;
    entries.push(entry);
  }

  return Buffer.concat([header, ...entries, ...images.map((image) => image.png)]);
}

// --- output ------------------------------------------------------------------

const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="UniSync">
  <rect width="64" height="64" rx="14" fill="#0b1f3a"/>
  <path d="M20 17v15a12 12 0 0 0 24 0V17" fill="none" stroke="#f97316" stroke-width="8" stroke-linecap="round"/>
</svg>
`;

const targets = [
  [resolve(ROOT, "src/app/icon.svg"), iconSvg, "utf8"],
  [resolve(ROOT, "src/app/apple-icon.png"), render(180, { rounded: false })],
  [
    resolve(ROOT, "src/app/favicon.ico"),
    encodeIco([
      { size: 16, png: render(16, { rounded: true }) },
      { size: 32, png: render(32, { rounded: true }) },
      { size: 48, png: render(48, { rounded: true }) },
    ]),
  ],
];

for (const [path, data] of targets) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
  console.log(`wrote ${path.replace(ROOT, ".")} (${Buffer.byteLength(data)} bytes)`);
}
