import fs from 'node:fs';
import path from 'node:path';
import { createReleaseMetadata } from '../src/shared/releaseMetadata.js';

const [packagePath, previousMetadataPath, outputPath] = process.argv.slice(2);
if (!packagePath || !previousMetadataPath || !outputPath) {
  throw new Error('usage: node scripts/write-release-metadata.mjs <package.json> <previous-version.json> <output-version.json>');
}

const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
let previousMetadata = null;
try {
  previousMetadata = JSON.parse(fs.readFileSync(previousMetadataPath, 'utf8'));
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

const metadata = createReleaseMetadata({
  packageVersion: packageJson.version,
  previousMetadata,
  publishedAt: new Date(),
  sourceCommit: process.env.GITHUB_SHA || '',
});
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
process.stdout.write(`Prepared release metadata ${metadata.version}\n`);
