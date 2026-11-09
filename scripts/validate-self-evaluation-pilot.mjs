import fs from 'node:fs';

const REQUIRED = ['learning_objective', 'mechanism_focus', 'exercise', 'action', 'progress_measure', 'safety_and_limits'];
const TOPIC_RULES = {
  T15: { name: 'اعتمادبه‌نفس پایین', evidence: ['EVID_BANDURA_1977', 'EVID_SELF_EFFICACY_IBI_2025'] },
  T23: { name: 'احساس بی‌ارزشی', evidence: ['EVID_SELFESTEEM_CFT_2021', 'EVID_SELFESTEEM_META_2021'] },
  T33: { name: 'خودانتقادی', evidence: ['EVID_SELFCRITICISM_CBI_2021', 'EVID_CFT_SHAME_2025', 'EVID_SELFCRITICISM_EFT_2026'] },
  T19: { name: 'خودسرزنشی', evidence: ['EVID_SELFBLAME_REVIEW_2020', 'EVID_GUILT_MEASUREMENT_2010', 'EVID_JANOFF_BULMAN_1979'] },
  T26: { name: 'شرم', evidence: ['EVID_SHAME_GUILT_2018', 'EVID_CFT_SHAME_2025'] }
};
const PHASES = {
  4: 'guided_skill_building',
  5: 'guided_skill_building',
  6: 'guided_skill_building',
  7: 'guided_skill_application',
  8: 'consolidation_and_review'
};
const norm = (value) => String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const unique = (values) => new Set(values).size === values.length;

export function validateSelfEvaluationPilot({ pilot, queue, evidence }) {
  const errors = [];
  const records = Array.isArray(pilot?.records) ? pilot.records : [];
  const queueRecords = Array.isArray(queue?.records) ? queue.records : [];
  const sources = Array.isArray(evidence?.sources) ? evidence.sources : [];
  const evidenceById = new Map(sources.map((source) => [source.evidence_id, source]));
  const queueSlots = new Map();

  if (!Array.isArray(pilot?.records)) errors.push('pilot.records must be an array');
  if (!Array.isArray(queue?.records)) errors.push('queue.records must be an array');
  if (!Array.isArray(evidence?.sources)) errors.push('evidence.sources must be an array');
  if (records.length !== 25) errors.push('pilot must contain exactly 25 records');
  if (queue?.total_records !== 952 || queueRecords.length !== 952) errors.push('queue must contain exactly 952 records');

  for (const item of queueRecords) {
    const slot = item.topic_id + ':' + item.day_number;
    queueSlots.set(slot, (queueSlots.get(slot) ?? 0) + 1);
  }

  const seenContentIds = new Set();
  for (const topicId of Object.keys(TOPIC_RULES)) {
    for (let day = 4; day <= 8; day++) {
      const slot = topicId + ':' + day;
      const matches = records.filter((record) => record.topic_id === topicId && record.day_number === day);
      if (matches.length !== 1) errors.push('expected exactly one draft for ' + slot);
      if (queueSlots.get(slot) !== 1) errors.push('expected exactly one queue slot for ' + slot);
    }
  }

  for (const record of records) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      errors.push('each pilot record must be an object');
      continue;
    }

    const topicId = record.topic_id;
    const topicRule = TOPIC_RULES[topicId];
    const day = record.day_number;
    const slot = topicId + ':' + day;

    if (!topicRule || !Number.isInteger(day) || day < 4 || day > 8) {
      errors.push('out-of-scope record ' + String(record.content_id ?? '(missing id)'));
      continue;
    }

    const expectedId = 'DRAFT_' + topicId + '_D' + String(day).padStart(2, '0');
    const expectedSourceId = topicRule.name + '-' + String(day).padStart(2, '0');
    if (record.content_id !== expectedId) errors.push('content id mismatch ' + record.content_id);
    if (seenContentIds.has(record.content_id)) errors.push('duplicate content id ' + record.content_id);
    seenContentIds.add(record.content_id);
    if (record.topic_name !== topicRule.name) errors.push('topic name mismatch ' + record.content_id);
    if (topicId === 'T19' && day === 6 && record.subtopic_id !== 'T19-S01') {
      errors.push('subtopic mismatch ' + record.content_id + ': T19 day 6 must map to behavior-specific responsibility T19-S01');
    }
    if (record.source_content_id !== expectedSourceId) errors.push('source content id mismatch ' + record.content_id);
    if (!norm(record.subtopic_id) || !norm(record.subtopic_name)) errors.push('missing subtopic mapping ' + record.content_id);
    if (record.phase !== PHASES[day]) errors.push('phase mismatch ' + record.content_id);

    for (const field of REQUIRED) {
      if (!norm(record[field])) errors.push('missing ' + field + ' ' + record.content_id);
    }

    if (record.review_status !== 'draft_pending_expert_review' || record.runtime_eligible !== false) {
      errors.push('draft must remain blocked ' + record.content_id);
    }

    if (record.evidence_mapping_status !== 'candidate_only_pending_claim_level_review') {
      errors.push('evidence mapping must remain candidate-only pending claim review ' + record.content_id);
    }
    const ids = Array.isArray(record.evidence_ids) ? record.evidence_ids : [];
    const referenceIds = Array.isArray(record.source_reference_ids) ? record.source_reference_ids : [];
    const candidateIds = Array.isArray(record.candidate_evidence_ids) ? record.candidate_evidence_ids : [];
    if ([...ids].sort().join('|') !== [...candidateIds].sort().join('|')) {
      errors.push('candidate evidence ids must match provenance ids ' + record.content_id);
    }
    if (ids.length === 0) errors.push('missing evidence provenance ' + record.content_id);
    if (!unique(ids)) errors.push('duplicate evidence id ' + record.content_id);
    if (!unique(referenceIds)) errors.push('duplicate source reference id ' + record.content_id);

    for (const id of ids) {
      const source = evidenceById.get(id);
      if (!source) {
        errors.push('unknown evidence id ' + id + ' in ' + record.content_id);
        continue;
      }
      if (!topicRule.evidence.includes(id)) errors.push('evidence not approved for ' + topicId + ': ' + id);
      const scopedTopics = norm(source.scope).split(/[;,\s]+/).filter(Boolean);
      if (!scopedTopics.includes(topicId)) errors.push('evidence scope mismatch for ' + topicId + ': ' + id);
    }

    if (referenceIds.length === 0 || [...ids].sort().join('|') !== [...referenceIds].sort().join('|')) {
      errors.push('source references must exactly match evidence ids ' + record.content_id);
    }

    const matchingQueue = queueRecords.filter((item) => item.topic_id === topicId && item.day_number === day);
    const queueItem = matchingQueue[0];
    if (!queueItem || queueItem.draft_content_id !== record.content_id || queueItem.source_content_id !== record.source_content_id) {
      errors.push('queue mapping mismatch ' + slot);
    }
    if (queueItem && (
      queueItem.redesign_status !== 'draft_created_pending_review' ||
      queueItem.review_status !== 'pending_review' ||
      queueItem.runtime_eligible !== false
    )) errors.push('queue gate mismatch ' + slot);
    if (queueItem && Object.values(queueItem.scores ?? {}).some((value) => value !== null)) {
      errors.push('queue scores must remain null ' + slot);
    }
  }

  for (const topicId of Object.keys(TOPIC_RULES)) {
    const group = records.filter((record) => record?.topic_id === topicId).sort((a, b) => a.day_number - b.day_number);
    for (const field of ['learning_objective', 'mechanism_focus', 'exercise', 'action', 'progress_measure']) {
      const values = group.map((record) => norm(record[field]));
      if (new Set(values).size !== values.length) errors.push('non-progressive repeated ' + field + ' for ' + topicId);
    }
  }

  for (let day = 4; day <= 8; day++) {
    const group = records.filter((record) => record?.day_number === day);
    for (const field of ['learning_objective', 'exercise', 'action', 'progress_measure']) {
      const values = group.map((record) => norm(record[field]));
      if (new Set(values).size !== values.length) errors.push('duplicate daily ' + field + ' on day ' + day);
    }
  }

  if (records.some((record) => record?.topic_id === 'T18')) errors.push('T18 must not have an instructional pilot draft');

  return {
    valid: errors.length === 0,
    errors,
    summary: {
      drafts: records.length,
      topics: Object.keys(TOPIC_RULES).length,
      days: '04-08',
      runtime_eligible: records.filter((record) => record?.runtime_eligible === true).length
    }
  };
}

if (process.argv[1]?.endsWith('validate-self-evaluation-pilot.mjs')) {
  const read = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
  const result = validateSelfEvaluationPilot({
    pilot: read('public/assistant/content-drafts/day04-08-self-evaluation-cluster-pilot.v1.json'),
    queue: read('public/assistant/content-drafts/952-day-redesign-queue.v1.json'),
    evidence: read('public/assistant/evidence/evidence-source-registry.v1.json')
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.valid) throw new Error('Self-evaluation pilot validation failed');
}
