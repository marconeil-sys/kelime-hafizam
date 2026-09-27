import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const source = path.join(projectRoot, 'public', 'icons', 'icon.svg');
const outputDirectory = path.join(projectRoot, 'public', 'icons');

await mkdir(outputDirectory, { recursive: true });

await Promise.all([
  sharp(source).resize(192, 192).png().toFile(path.join(outputDirectory, 'icon-192.png')),
  sharp(source).resize(512, 512).png().toFile(path.join(outputDirectory, 'icon-512.png')),
  sharp(source)
    .resize(192, 192)
    .flatten({ background: '#4f46e5' })
    .png()
    .toFile(path.join(outputDirectory, 'maskable-192.png')),
  sharp(source)
    .resize(512, 512)
    .flatten({ background: '#4f46e5' })
    .png()
    .toFile(path.join(outputDirectory, 'maskable-512.png')),
  sharp(source)
    .resize(180, 180)
    .flatten({ background: '#4f46e5' })
    .png()
    .toFile(path.join(outputDirectory, 'apple-touch-icon.png')),
]);
