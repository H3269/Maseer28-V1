import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const SHARED_COPY_FIELDS = ['proposed_title', 'proposed_intro', 'proposed_closing'];
export const PROPOSAL_FILES = [
  'public/assistant/content-drafts/day01-support-copy-proposals-34-topics.v1.json',
  'public/assistant/content-drafts/day01-shared-copy-proposals-34-topics.v1.json',
  'public/assistant/content-drafts/day02-shared-copy-proposals-34-topics.v1.json',
  'public/assistant/content-drafts/day03-shared-copy-proposals-34-topics.v1.json',
];
export function auditSharedCopyProposal(proposal, expectedTopics = 34) {
  const records = Array.isArray(proposal?.records) ? proposal.records : [];
  const errors = [];
  if (records.length !== expectedTopics) errors.push(`expected_${expectedTopics}_records_found_${records.length}`);
  const ids = records.map((record) => record.topic_id);
  if (new Set(ids).size !== ids.length) errors.push('duplicate_topic_ids');
  const fields = Array.isArray(proposal?.fields) ? proposal.fields : SHARED_COPY_FIELDS;
  for (const field of fields) {
    const values = records.map((record) => String(record?.[field] ?? '').trim());
    if (values.some((value) => !value)) errors.push(`empty_${field}`);
    if (new Set(values).size !== values.length) errors.push(`duplicate_${field}`);
  }
  if (records.some((record) => record.runtime_eligible !== false)) errors.push('runtime_eligible_record_found');
  if (records.some((record) => (record.copy_review_status ?? record.review_status) !== 'draft_pending_expert_review')) errors.push('review_status_mismatch');
  if (proposal?.status !== 'draft_pending_expert_review') errors.push('proposal_status_mismatch');
  return { ok: errors.length === 0, record_count: records.length, unique_topic_count: new Set(ids).size, errors };
}
function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const batches = PROPOSAL_FILES.map((relativePath) => {
    const proposal = JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
    return { file: relativePath, batch_id: proposal.batch_id, ...auditSharedCopyProposal(proposal) };
  });
  const failures = batches.filter((batch) => !batch.ok);
  const output = { schema_version: '1.0.0', audit_type: 'day_1_to_3_shared_copy_proposal_integrity', status: failures.length ? 'failed' : 'passed', batches, total_records: batches.reduce((sum, batch) => sum + batch.record_count, 0), runtime_content_changed: false, expert_approval_granted: false };
  const outDir = path.join(root, 'reports/generated');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'day01-03-shared-copy-proposal-audit.json'), JSON.stringify(output, null, 2) + '\n', 'utf8');
  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
  if (failures.length) process.exitCode = 1;
}
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) main();
