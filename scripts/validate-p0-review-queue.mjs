import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validateP0ReviewQueue } from './lib/p0ReviewQueueValidation.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const canonicalRaw = fs.readFileSync(path.join(root, 'public/content/path-content.json'), 'utf8');
const canonicalBlobSha = createHash('sha1')
  .update(`blob ${Buffer.byteLength(canonicalRaw)}\\0`)
  .update(canonicalRaw)
  .digest('hex');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const errors = validateP0ReviewQueue({
  ledger: read('docs/review-data/P0_DAILY_CONTENT_REVIEW_QUEUE_V1.json'),
  canonicalContent: JSON.parse(canonicalRaw),
  topicRegistry: read('public/assistant/knowledge/topics.v1.json'),
  subtopicRegistry: read('public/assistant/knowledge/subtopics.v1.json'),
  canonicalBlobSha,
});
if (errors.length) {
  console.error('P0 review queue validation failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log('P0 review queue valid: 9 topics, 252 unique canonical IDs, no automatic approval or runtime activation.');
}
