import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const svgPath = path.join(publicDir, 'icon.svg');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function main() {
  const svg = await fs.readFile(svgPath);

  await Promise.all(
    sizes.map(async (size) => {
      const outPath = path.join(publicDir, `icon-${size}x${size}.png`);
      await sharp(svg)
        .resize(size, size)
        .png({ compressionLevel: 9, adaptiveFiltering: true })
        .toFile(outPath);
      process.stdout.write(`Generated ${path.relative(root, outPath)}\n`);
    })
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
