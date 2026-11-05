import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validateP0ReviewQueue } from './lib/p0ReviewQueueValidation.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readRaw = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const gitBlobSha = (raw) => createHash('sha1')
  .update(`blob ${Buffer.byteLength(raw)}\0`)
  .update(raw)
  .digest('hex');
const canonicalRaw = readRaw('public/content/path-content.json');
const topicRegistryRaw = readRaw('public/assistant/knowledge/topics.v1.json');
const subtopicRegistryRaw = readRaw('public/assistant/knowledge/subtopics.v1.json');
const canonicalBlobSha = gitBlobSha(canonicalRaw);
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const errors = validateP0ReviewQueue({
  ledger: read('docs/review-data/P0_DAILY_CONTENT_REVIEW_QUEUE_V1.json'),
  canonicalContent: JSON.parse(canonicalRaw),
  topicRegistry: JSON.parse(topicRegistryRaw),
  subtopicRegistry: JSON.parse(subtopicRegistryRaw),
  canonicalBlobSha,
  topicRegistryBlobSha: gitBlobSha(topicRegistryRaw),
  subtopicRegistryBlobSha: gitBlobSha(subtopicRegistryRaw),
});
if (errors.length) {
  console.error('P0 review queue validation failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log('P0 review queue valid: 9 topics, 252 unique canonical IDs, no automatic approval or runtime activation.');
}
