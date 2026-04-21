/**
 * Generate PWA icon PNGs from an SVG template using sharp.
 * Usage: npx tsx src/scripts/generate-pwa-icons.ts
 */

import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', '..', 'public', 'icons');

function buildSvg(size: number): string {
  const r = Math.round(size * 0.22);
  const barW = Math.round(size * 0.09);
  const gap = Math.round(size * 0.055);
  const barsHeight = Math.round(size * 0.6);
  const cx = size / 2;
  const baseY = Math.round(size * 0.5 + barsHeight / 2);
  const barRadius = barW / 2;

  const heights = [0.47, 0.68, 0.9, 0.68, 0.47].map((f) =>
    Math.round(barsHeight * f),
  );
  const totalBarsW = 5 * barW + 4 * gap;
  const startX = cx - totalBarsW / 2;

  const bars = heights
    .map((h, i) => {
      const x = startX + i * (barW + gap);
      const y = baseY - h;
      const fill = i === 2 ? '#60a5fa' : 'white';
      return `<rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="${barRadius}" fill="${fill}"/>`;
    })
    .join('\n    ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f2847"/>
      <stop offset="100%" stop-color="#1d4ed8"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${r}" fill="url(#bg)"/>
  <g>
    ${bars}
  </g>
</svg>`;
}

async function main() {
  mkdirSync(outDir, { recursive: true });

  for (const size of [192, 512]) {
    const svg = buildSvg(size);
    const outPath = join(outDir, `icon-${size}x${size}.png`);
    await sharp(Buffer.from(svg)).png().toFile(outPath);
    console.log(`Generated ${outPath}`);
  }
}

main().catch(console.error);
