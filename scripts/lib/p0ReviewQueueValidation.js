export const P0_TOPIC_IDS = Object.freeze(['T04', 'T06', 'T10', 'T11', 'T12', 'T17', 'T18', 'T31', 'T34']);
const TRIAGE = new Set(['unassigned_pending_review', 'topic_specific', 'general_support', 'needs_clarification', 'out_of_scope']);
const DECISIONS = new Set(['accept', 'revise', 'hold_for_safety_review', 'needs_more_context']);
const SAFETY = new Set(['not_reviewed', 'pending_specialist_review', 'reviewed_with_conditions', 'hold']);
const text = (v) => typeof v === 'string' && v.trim().length > 0;
const date = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v));

export function validateP0ReviewQueue({ ledger, canonicalContent, topicRegistry, subtopicRegistry, canonicalBlobSha, topicRegistryBlobSha, subtopicRegistryBlobSha }) {
  const errors = [];
  const topics = new Map((topicRegistry.topics || []).map((t) => [t.topic_id, t]));
  const subtopics = new Map();
  for (const s of subtopicRegistry.subtopics || []) {
    if (!subtopics.has(s.topic_id)) subtopics.set(s.topic_id, new Set());
    subtopics.get(s.topic_id).add(s.subtopic_id);
  }
  if (ledger?.schema_version !== '1.0.0') errors.push('schema version invalid');
  if (ledger?.status !== 'working_queue_not_approved_content') errors.push('queue status must remain non-approved');
  if (ledger?.policy?.runtime_eligibility !== false) errors.push('runtime eligibility must remain false');
  if (ledger?.policy?.no_automatic_subtopic_assignment !== true) errors.push('automatic subtopic assignment must be disabled');
  if (ledger?.policy?.no_ai_approval !== true) errors.push('AI approval must be disabled');
  if (ledger?.generated_from?.canonical_blob_sha !== canonicalBlobSha) errors.push('canonical source fingerprint is stale');
  if (ledger?.generated_from?.topic_registry_blob_sha !== topicRegistryBlobSha) errors.push('topic registry fingerprint is stale');
  if (ledger?.generated_from?.subtopic_registry_blob_sha !== subtopicRegistryBlobSha) errors.push('subtopic registry fingerprint is stale');
  const scope = ledger?.scope?.topic_ids || [];
  if (scope.length !== 9 || P0_TOPIC_IDS.some((id, i) => scope[i] !== id)) errors.push('scope must contain the exact nine P0 topics');
  if (ledger?.scope?.topic_count !== 9 || ledger?.scope?.days_per_topic !== 28) errors.push('scope counts must remain 9 topics by 28 days');
  if (ledger?.scope?.entry_count !== 252 || !Array.isArray(ledger?.entries) || ledger.entries.length !== 252) errors.push('queue must contain exactly 252 entries');

  const canonical = new Map();
  for (const topicId of P0_TOPIC_IDS) {
    const topic = topics.get(topicId);
    if (!topic) { errors.push(`missing topic ${topicId}`); continue; }
    const days = canonicalContent?.categories?.[topic.name]?.days;
    if (!Array.isArray(days) || days.length !== 28) { errors.push(`topic ${topicId} must have 28 canonical days`); continue; }
    days.forEach((d, i) => { if (d?.id) canonical.set(d.id, { topicId, day: i + 1 }); });
  }

  const seen = new Set();
  for (const [i, e] of (ledger?.entries || []).entries()) {
    const id = e?.id || `row-${i + 1}`;
    if (!text(e?.id)) errors.push(`${id}: empty ID`);
    if (seen.has(e?.id)) errors.push(`${id}: duplicate ID`);
    seen.add(e?.id);
    const source = canonical.get(e?.id);
    if (!source) errors.push(`${id}: ID absent from canonical`);
    else if (e.topic_id !== source.topicId || e.day !== source.day) errors.push(`${id}: topic/day mismatch`);
    if (!P0_TOPIC_IDS.includes(e?.topic_id)) errors.push(`${id}: topic outside P0`);
    if (e?.source?.path !== 'public/content/path-content.json' || e?.source?.blob_sha !== ledger?.generated_from?.canonical_blob_sha) errors.push(`${id}: invalid source trace`);
    if (!TRIAGE.has(e?.triage_status)) errors.push(`${id}: invalid triage status`);
    if (!Array.isArray(e?.subtopic_ids)) errors.push(`${id}: subtopic_ids must be an array`);
    for (const subId of e?.subtopic_ids || []) if (!subtopics.get(e.topic_id)?.has(subId)) errors.push(`${id}: subtopic does not belong to topic`);
    if (e?.review_decision !== null && !DECISIONS.has(e?.review_decision)) errors.push(`${id}: invalid review decision`);
    if (!SAFETY.has(e?.safety_gate_status)) errors.push(`${id}: invalid safety status`);
    const reviewer = e?.reviewer || {};
    const humanTrace = text(reviewer.name) && text(reviewer.qualification) && text(e.review_record_id) && date(e.reviewed_at);
    const activity = e?.triage_status !== 'unassigned_pending_review' || (e?.subtopic_ids || []).length > 0 ||
      e?.review_decision !== null || e?.safety_gate_status !== 'not_reviewed' ||
      e?.learning_objective !== null || e?.target_skill !== null || e?.teaching_point !== null;
    if (activity && !humanTrace) errors.push(`${id}: review activity requires named qualified human trace`);
    if (e?.triage_status === 'topic_specific') {
      if (!(e.subtopic_ids || []).length) errors.push(`${id}: topic_specific requires subtopic`);
      if (!text(e.learning_objective) || !text(e.target_skill) || !text(e.teaching_point)) errors.push(`${id}: topic-specific learning fields required`);
      if (!Array.isArray(e.evidence_refs) || !e.evidence_refs.length) errors.push(`${id}: topic_specific requires evidence`);
    } else if ((e?.subtopic_ids || []).length) errors.push(`${id}: only topic_specific may have subtopic IDs`);
    if (!Array.isArray(e?.evidence_refs)) errors.push(`${id}: evidence_refs must be an array`);
  }
  if (seen.size !== 252) errors.push('unique ID count must be 252');
  return errors;
}
