import { spawnSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const sourceDir = 'public/assets/covers';
const outputDir = join(sourceDir, 'library');
const books = [1, 2, 3, 4, 5];
const inputs = books.map((n) => join(sourceDir, `book${n}.webp`));
const outputs = books.map((n) => join(outputDir, `book${n}.webp`));

mkdirSync(outputDir, { recursive: true });
const args = [
  '--yes',
  '--package=sharp-cli@6.1.0',
  '--',
  'sharp',
  '--input',
  join(sourceDir, 'book*.webp'),
  '--output',
  join(outputDir, '{name}.webp'),
  '--format',
  'webp',
  '--quality',
  '72',
  'resize',
  '360',
  '522',
];
const result = spawnSync('npx', args, { stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`Cover thumbnail generation failed (exit ${result.status}).`);

let sourceBytes = 0;
let thumbnailBytes = 0;
for (let i = 0; i < books.length; i += 1) {
  const source = statSync(inputs[i]);
  const thumbnail = statSync(outputs[i]);
  if (!thumbnail.size || thumbnail.size >= source.size) {
    throw new Error(`Thumbnail book${books[i]} is not smaller than its source image.`);
  }
  sourceBytes += source.size;
  thumbnailBytes += thumbnail.size;
}
if (thumbnailBytes > 600 * 1024) {
  throw new Error(`Library thumbnails exceed the 600 KiB budget: ${thumbnailBytes} bytes.`);
}
console.log(JSON.stringify({
  sourceBytes,
  thumbnailBytes,
  savedBytes: sourceBytes - thumbnailBytes,
  reductionPercent: Number(((1 - thumbnailBytes / sourceBytes) * 100).toFixed(1)),
  dimensions: '360x522',
  quality: 72,
}, null, 2));
