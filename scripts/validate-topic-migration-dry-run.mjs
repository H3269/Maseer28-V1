import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readText = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const readJson = p => JSON.parse(readText(p));
const gitBlobSha = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text, 'utf8') + '\0').update(text).digest('hex');

export function buildDryRunReport() {
  const legacyText = readText('public/content/path-content.json');
  const queueText = readText('public/assistant/content-drafts/952-day-redesign-queue.v1.json');
  const topicsText = readText('public/assistant/knowledge/topics.v1.json');
  const subtopicsText = readText('public/assistant/knowledge/subtopics.v1.json');
  const crosswalkText = readText('public/assistant/migrations/topic-crosswalk.v1.json');
  const aliasesText = readText('public/assistant/migrations/topic-aliases.v1.json');
  const draftPaths = [
    'public/assistant/content-drafts/day01-34-topic-drafts.v1.json',
    'public/assistant/content-drafts/day02-34-topic-drafts.v1.json',
    'public/assistant/content-drafts/day03-34-topic-drafts.v1.json'
  ];
  const legacy = JSON.parse(legacyText), queue = JSON.parse(queueText);
  const topics = JSON.parse(topicsText).topics, subtopics = JSON.parse(subtopicsText).subtopics;
  const crosswalk = JSON.parse(crosswalkText), aliases = JSON.parse(aliasesText).aliases;
  const draftRecords = draftPaths.flatMap(p => readJson(p).records || []);
  const topicById = new Map(topics.map(x => [x.topic_id, x]));
  const subtopicById = new Map(subtopics.map(x => [x.subtopic_id, x]));
  const aliasByName = new Map(aliases.map(x => [x.value.normalize('NFC').trim(), x]));
  const topicMappingByTarget = new Map(crosswalk.topic_mappings.map(x => [x.targets?.[0]?.id, x]));
  const legacyById = new Map();
  const categoryNames = Object.keys(legacy.categories || {});
  for (const [category, data] of Object.entries(legacy.categories || {})) {
    for (const day of data.days || []) legacyById.set(day.id, { category, day });
  }
  const draftById = new Map(draftRecords.map(x => [x.content_id, x]));
  const counts = {}, anomalies = [], seenReview = new Set(), seenSource = new Set(), seenDraft = new Set();
  const bookReferenceCounts = {}; let daysWithBookReference = 0, runtimeEligible = 0, queueSubtopicCount = 0;
  const recordResults = [];
  for (const r of queue.records || []) {
    const source = legacyById.get(r.source_content_id);
    const alias = aliasByName.get((r.topic_name || '').normalize('NFC').trim());
    const topic = topicById.get(r.topic_id);
    const mapping = topicMappingByTarget.get(r.topic_id);
    const draft = r.draft_content_id ? draftById.get(r.draft_content_id) : null;
    const draftSubtopic = draft ? subtopicById.get(draft.subtopic_id) : null;
    let classification = 'candidate_mapped';
    if (!source) classification = 'unmapped_source_record';
    else if (!topic) classification = 'unknown_topic_id';
    else if (!alias) classification = 'unmatched_alias';
    else if (alias.target_topic_id !== r.topic_id || !mapping || mapping.decision_status !== 'candidate_exact_name_match') classification = 'topic_alias_crosswalk_conflict';
    else if (source.category !== r.topic_name || topic.name !== r.topic_name || mapping.source.label !== source.category) classification = 'source_category_label_mismatch';
    else if (r.day_number !== source.day.day) classification = 'day_number_mismatch';
    else if (r.draft_content_id && !draft) classification = 'missing_draft_record';
    else if (draft && (draft.topic_id !== r.topic_id || draft.source_content_id !== r.source_content_id || draft.day_number !== r.day_number)) classification = 'draft_source_or_topic_conflict';
    else if (draft && (!draftSubtopic || draftSubtopic.topic_id !== draft.topic_id)) classification = 'invalid_draft_subtopic';
    counts[classification] = (counts[classification] || 0) + 1;
    if (seenReview.has(r.review_id)) anomalies.push({ type: 'duplicate_review_id', id: r.review_id });
    if (seenSource.has(r.source_content_id)) anomalies.push({ type: 'duplicate_source_content_id', id: r.source_content_id });
    if (r.draft_content_id && seenDraft.has(r.draft_content_id)) anomalies.push({ type: 'duplicate_draft_content_id', id: r.draft_content_id });
    seenReview.add(r.review_id); seenSource.add(r.source_content_id); if (r.draft_content_id) seenDraft.add(r.draft_content_id);
    if (r.runtime_eligible === true) runtimeEligible++;
    if (Object.hasOwn(r, 'subtopic_id')) queueSubtopicCount++;
    if (source?.day?.legacyBookRec) { daysWithBookReference++; const id = String(source.day.legacyBookRec.bookId); bookReferenceCounts[id] = (bookReferenceCounts[id] || 0) + 1; }
    if (classification !== 'candidate_mapped') anomalies.push({ type: classification, review_id: r.review_id, source_content_id: r.source_content_id, topic_id: r.topic_id });
    recordResults.push({ review_id: r.review_id, source_content_id: r.source_content_id, topic_id: r.topic_id, topic_name: r.topic_name, day_number: r.day_number, draft_content_id: r.draft_content_id || null, alias_id: alias?.alias_id || null, source_exists: !!source, source_category: source?.category || null, source_day: source?.day?.day ?? null, draft_exists: !!draft, draft_subtopic_id: draft?.subtopic_id || null, draft_subtopic_valid: draft ? !!draftSubtopic && draftSubtopic.topic_id === draft.topic_id : null, classification, proposed_action: classification === 'candidate_mapped' ? (draft ? 'preserve_draft_pending_review' : 'preserve_legacy_content_pending_redesign') : 'quarantine_for_manual_review' });
  }
  const draftsNotLinked = draftRecords.filter(d => !(queue.records || []).some(r => r.draft_content_id === d.content_id)).map(d => d.content_id);
  const noDraftByDay = {};
  for (const r of queue.records || []) if (!r.draft_content_id) noDraftByDay[r.day_number] = (noDraftByDay[r.day_number] || 0) + 1;
  const categoryStats = categoryNames.map(name => { const alias = aliasByName.get(name.normalize('NFC').trim()); return { name, days: legacy.categories[name].days.length, alias: alias?.target_topic_id || null, topicNameMatch: topics.find(t => t.topic_id === alias?.target_topic_id)?.name === name }; });
  const sourceFiles = {
    'public/content/path-content.json': legacyText,
    'public/assistant/content-drafts/952-day-redesign-queue.v1.json': queueText,
    'public/assistant/knowledge/topics.v1.json': topicsText,
    'public/assistant/knowledge/subtopics.v1.json': subtopicsText,
    'public/assistant/migrations/topic-crosswalk.v1.json': crosswalkText,
    'public/assistant/migrations/topic-aliases.v1.json': aliasesText,
    ...Object.fromEntries(draftPaths.map(p => [p, readText(p)]))
  };
  return {
    report_version: '1.0.0', report_id: 'maseer28-topic-migration-dry-run-952-v1', status: 'read_only_simulation_not_migration',
    generated_from: { branch: 'feature/topic-taxonomy-audit-v1', source_git_blob_shas: Object.fromEntries(Object.entries(sourceFiles).map(([p, s]) => [p, gitBlobSha(s)])) },
    safety: { source_files_modified: false, user_data_accessed: false, records_written_to_runtime: false, execution_allowed: false },
    source_summary: { legacy_version: legacy.version, categories: categoryNames.length, legacy_days: legacyById.size, queue_declared_total: queue.total_records, queue_actual_records: (queue.records || []).length, draft_records: draftRecords.length, legacy_days_with_book_reference: daysWithBookReference, book_reference_counts: bookReferenceCounts },
    mapping_summary: { classification_counts: counts, all_aliases_exact_match: categoryStats.every(x => !!x.alias), all_queue_topic_ids_exist: (queue.records || []).every(r => topicById.has(r.topic_id)), all_queue_source_ids_exist: (queue.records || []).every(r => legacyById.has(r.source_content_id)), all_topic_labels_match_source: (queue.records || []).every(r => legacyById.get(r.source_content_id)?.category === r.topic_name), all_day_numbers_match_source: (queue.records || []).every(r => legacyById.get(r.source_content_id)?.day.day === r.day_number), drafts_in_queue: (queue.records || []).filter(r => r.draft_content_id).length, drafts_not_in_queue: draftsNotLinked.length, queue_has_subtopic_id: queueSubtopicCount > 0, runtime_eligible_records: runtimeEligible, queue_duplicate_review_ids: anomalies.filter(x => x.type === 'duplicate_review_id').length, queue_duplicate_source_ids: anomalies.filter(x => x.type === 'duplicate_source_content_id').length, queue_duplicate_draft_ids: anomalies.filter(x => x.type === 'duplicate_draft_content_id').length },
    category_stats: categoryStats, day_distribution_without_draft: noDraftByDay, record_results: recordResults, anomalies, draft_records_not_linked_to_queue: draftsNotLinked
  };
}

export function validateDryRunReport(report, fresh = buildDryRunReport()) {
  const errors = [];
  if (report.report_id !== fresh.report_id || report.report_version !== fresh.report_version) errors.push('Report identity/version mismatch.');
  if (JSON.stringify(report.generated_from.source_git_blob_shas) !== JSON.stringify(fresh.generated_from.source_git_blob_shas)) errors.push('Stored dry-run report is stale: source blob hashes differ.');
  if (JSON.stringify(report.mapping_summary) !== JSON.stringify(fresh.mapping_summary)) errors.push('Stored mapping summary differs from recomputed result.');
  if (JSON.stringify(report.record_results) !== JSON.stringify(fresh.record_results)) errors.push('Stored per-record results differ from recomputed result.');
  if (report.safety.execution_allowed !== false || report.safety.records_written_to_runtime !== false) errors.push('Dry-run safety invariant violated.');
  if (fresh.mapping_summary.runtime_eligible_records !== 0) errors.push('Unexpected runtime-eligible records in source queue.');
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const reportPath = path.join(ROOT, 'docs/reports/TOPIC_MIGRATION_DRY_RUN_952_V1.json');
  const fresh = buildDryRunReport();
  if (process.argv.includes('--write')) {
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(fresh, null, 2) + '\n');
    console.log('Wrote read-only dry-run report; no source content or runtime data was modified.');
  } else {
    const stored = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const errors = validateDryRunReport(stored, fresh);
    if (errors.length) { console.error(errors.join('\\n')); process.exitCode = 1; }
    else console.log('Dry-run report is current: ' + fresh.source_summary.legacy_days + ' source days; ' + fresh.source_summary.queue_actual_records + ' queue records; ' + JSON.stringify(fresh.mapping_summary.classification_counts) + '; zero runtime activation.');
  }
}
