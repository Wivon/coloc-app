/**
 * Génère les icônes PNG de la PWA sans dépendance externe.
 *
 *   node scripts/generate-icons.mjs
 *
 * Le dessin est procédural (toit + murs + porte) : pas de police à embarquer, et
 * l'icône reste nette à toutes les tailles. Rejouer le script après un changement
 * de couleur d'accent dans `globals.css`.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const ACCENT = [15, 123, 108]; // --accent
const INK = [255, 255, 255];

const TARGETS = [
  { path: 'public/icon-192.png', size: 192, radius: 0.22, inset: 0.2 },
  { path: 'public/icon-512.png', size: 512, radius: 0.22, inset: 0.2 },
  // Maskable : le glyphe reste dans la « safe zone » centrale de 80 %.
  { path: 'public/icon-maskable-512.png', size: 512, radius: 0, inset: 0.3 },
  // iOS applique lui-même le masque arrondi.
  { path: 'src/app/apple-icon.png', size: 180, radius: 0, inset: 0.2 },
  { path: 'src/app/icon.png', size: 64, radius: 0.22, inset: 0.16 },
];

function main() {
  for (const target of TARGETS) {
    const png = encodePng(target.size, target.size, drawIcon(target));
    mkdirSync(dirname(join(root, target.path)), { recursive: true });
    writeFileSync(join(root, target.path), png);
    console.log(`✓ ${target.path} (${target.size}×${target.size})`);
  }
}

/** Sous-échantillonnage : 4×4 points par pixel pour des bords lisses. */
const SAMPLES = 4;

/** Renvoie un buffer RGBA de `size × size`. */
function drawIcon({ size, radius, inset }) {
  const pixels = Buffer.alloc(size * size * 4);
  const cornerRadius = radius * size;

  // Géométrie du glyphe, exprimée en fraction de la taille totale.
  const margin = inset * size;
  const span = size - margin * 2;
  const roofBase = margin + span * 0.42;
  const wallLeft = margin + span * 0.14;
  const wallRight = margin + span * 0.86;
  const wallBottom = margin + span;
  const doorWidth = span * 0.2;
  const doorLeft = size / 2 - doorWidth / 2;
  const doorTop = wallBottom - span * 0.3;

  const inCard = (x, y) => cornerRadius === 0 || insideRoundedRect(x, y, size, cornerRadius);
  const inGlyph = (x, y) => {
    const roofHalfWidth = ((span / 2) * (y - margin)) / (roofBase - margin);
    const inRoof = y >= margin && y <= roofBase && Math.abs(x - size / 2) <= roofHalfWidth;
    const inWalls = y > roofBase && y <= wallBottom && x >= wallLeft && x <= wallRight;
    const inDoor = y >= doorTop && y <= wallBottom && x >= doorLeft && x <= doorLeft + doorWidth;
    return (inRoof || inWalls) && !inDoor;
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let card = 0;
      let glyph = 0;

      for (let sy = 0; sy < SAMPLES; sy += 1) {
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          const px = x + (sx + 0.5) / SAMPLES;
          const py = y + (sy + 0.5) / SAMPLES;
          if (!inCard(px, py)) continue;
          card += 1;
          if (inGlyph(px, py)) glyph += 1;
        }
      }

      const total = SAMPLES * SAMPLES;
      if (card === 0) continue;

      // Le glyphe est fondu dans l'accent, puis le tout dans la transparence.
      const glyphRatio = glyph / card;
      const color = ACCENT.map((channel, i) =>
        Math.round(channel + (INK[i] - channel) * glyphRatio),
      );
      write(pixels, (y * size + x) * 4, color, Math.round((card / total) * 255));
    }
  }

  return pixels;
}

function write(buffer, offset, [r, g, b], alpha = 255) {
  buffer[offset] = r;
  buffer[offset + 1] = g;
  buffer[offset + 2] = b;
  buffer[offset + 3] = alpha;
}

function insideRoundedRect(x, y, size, radius) {
  const cx = Math.min(Math.max(x, radius), size - radius);
  const cy = Math.min(Math.max(y, radius), size - radius);
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

// ---------------------------------------------------------------------------
// Encodeur PNG minimal (RGBA, sans filtre)
// ---------------------------------------------------------------------------

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filtre « None »
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // profondeur
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

main();
