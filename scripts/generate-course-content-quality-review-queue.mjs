import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReviewQueue } from './audit-course-content-quality.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));

export function buildCourseContentQualityReviewLedger({ content, topics, existing }) {
  if (existing?.runtime_eligible !== false) {
    throw new Error('Quality review ledger must remain runtime_eligible=false.');
  }
  const expected = buildReviewQueue(content, topics);
  const previous = existing?.reviews ?? [];
  const previousById = new Map(previous.map((item) => [item.review_id, item]));
  if (previousById.size !== previous.length) {
    throw new Error('Existing quality review ledger contains duplicate review IDs.');
  }
  const expectedById = new Map(expected.map((item) => [item.review_id, item]));
  const unknown = previous.filter((item) => !expectedById.has(item.review_id));
  if (unknown.length) {
    throw new Error('Existing quality review ledger contains records not present in the current course registry.');
  }

  const reviews = expected.map((item) => {
    const old = previousById.get(item.review_id);
    if (old && old.content_id !== item.content_id) {
      throw new Error(`Source content changed for ${item.review_id}; manual reconciliation required.`);
    }
    return old ?? item;
  });

  return {
    ...existing,
    schema_version: existing?.schema_version ?? '1.0.0',
    ledger_id: existing?.ledger_id ?? 'maseer28-course-content-quality-review-v1',
    status: existing?.status ?? 'draft_review_queue_only',
    runtime_eligible: false,
    scoring_dimensions: existing?.scoring_dimensions ?? [
      'target_specificity','psychological_mechanism','evidence_support','exercise_alignment',
      'progression_and_difficulty','safety_and_cautions','outcome_measurement','accessibility'
    ],
    reviews,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outputPath = path.join(root, 'public/assistant/reviews/course-content-quality-review.v1.json');
  const existing = readJson('public/assistant/reviews/course-content-quality-review.v1.json');
  const ledger = buildCourseContentQualityReviewLedger({
    content: readJson('public/content/path-content.json'),
    topics: readJson('public/assistant/knowledge/topics.v1.json'),
    existing,
  });
  fs.writeFileSync(outputPath, `${JSON.stringify(ledger, null, 2)}\\n`);
  process.stdout.write(`Generated ${ledger.reviews.length} pending quality review records; all remain runtime_eligible=false.\\n`);
}
