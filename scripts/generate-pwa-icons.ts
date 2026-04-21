import sharp from 'sharp';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const OUT_DIR = join(process.cwd(), 'public', 'icons');

function buildSvg(size: number): string {
  const radius = Math.round(size * 0.21);
  const icon = Math.round(size * 0.6);
  const offset = (size - icon) / 2;
  const scale = icon / 24;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#1d4ed8"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polygon points="12 2 20 7 4 7"/>
    <line x1="3" x2="21" y1="22" y2="22"/>
    <line x1="6" x2="6" y1="18" y2="11"/>
    <line x1="10" x2="10" y1="18" y2="11"/>
    <line x1="14" x2="14" y1="18" y2="11"/>
    <line x1="18" x2="18" y1="18" y2="11"/>
  </g>
</svg>`;
}

async function generate(size: number) {
  const svg = Buffer.from(buildSvg(size));
  const out = join(OUT_DIR, `icon-${size}x${size}.png`);
  await sharp(svg).png().toFile(out);
  console.log(`wrote ${out}`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await generate(192);
  await generate(512);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
