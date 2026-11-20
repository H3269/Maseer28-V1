import { spawnSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';

const source = 'scripts/assets/Logo m24.webp';
const output = 'public/assets/splash-logo.webp';
mkdirSync('public/assets', { recursive: true });
const args = [
  '--yes',
  '--package=sharp-cli@6.1.0',
  '--',
  'sharp',
  '--input', source,
  '--output', output,
  '--format', 'webp',
  '--quality', '58',
  'resize', '192', '192',
];
const result = spawnSync('npx', args, { stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`Splash logo generation failed (exit ${result.status}).`);
const sourceInfo = statSync(source);
const outputInfo = statSync(output);
if (!outputInfo.size || outputInfo.size >= sourceInfo.size) {
  throw new Error('The generated splash logo must be smaller than the original artwork.');
}
if (outputInfo.size > 40 * 1024) {
  throw new Error(`Splash logo exceeds the 40 KiB budget: ${outputInfo.size} bytes.`);
}
console.log(JSON.stringify({
  sourceBytes: sourceInfo.size,
  splashBytes: outputInfo.size,
  savedBytes: sourceInfo.size - outputInfo.size,
  reductionPercent: Number(((1 - outputInfo.size / sourceInfo.size) * 100).toFixed(1)),
  dimensions: '192x192',
  format: 'WebP',
  quality: 58,
}, null, 2));
