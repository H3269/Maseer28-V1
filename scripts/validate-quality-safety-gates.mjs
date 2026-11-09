import fs from 'node:fs';

const REQUIRED_DIMENSIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const REQUIRED_EVIDENCE_FIELDS = [
  'population', 'construct_or_intervention', 'outcome',
  'study_design_or_guideline_type', 'evidence_certainty',
  'limitations', 'last_checked'
];

export function validateQualitySafetyGates({ policy, queue, pilot, evidence }) {
  const errors = [];
  const warnings = [];
  const dimensions = policy?.review_dimensions ?? [];
  const sources = Array.isArray(evidence?.sources) ? evidence.sources : [];
  const sourceById = new Map(sources.map((source) => [source.evidence_id, source]));
  const queueRecords = Array.isArray(queue?.records) ? queue.records : [];
  const pilotRecords = Array.isArray(pilot?.records) ? pilot.records : [];

  if (policy?.schema_version !== '1.0.0') errors.push('quality policy schema_version must be 1.0.0');
  if (policy?.status !== 'proposed_pending_independent_review') errors.push('policy must remain pending independent review');
  if (policy?.core_rule !== 'automated_validation_is_not_expert_or_clinical_approval') errors.push('missing non-equivalence rule');
  if (dimensions.length !== 8 || !REQUIRED_DIMENSIONS.every((id) => dimensions.some((item) => item.id === id))) {
    errors.push('policy must define all eight review dimensions A-H');
  }
  for (const dimension of dimensions) {
    if (JSON.stringify(dimension.scale) !== JSON.stringify([0, 1, 2, 3, 4])) {
      errors.push('invalid score scale for dimension ' + dimension.id);
    }
  }
  if (policy?.scoring_policy?.reviewers_required !== 1 ||
      policy?.scoring_policy?.independent_reviews !== false ||
      policy?.scoring_policy?.review_model !== 'single_authorized_owner_expert_review' ||
      policy?.initial_pilot?.owner_expert_review_required !== true ||
      policy?.initial_pilot?.require_two_independent_reviews !== false) {
    errors.push('one authorized owner-expert review must be sufficient; peer review may only be optional');
  }
  if (policy?.scoring_policy?.minimum_score_for_release !== null) {
    errors.push('release threshold must remain unset pending calibration');
  }
  if (policy?.scoring_policy?.hard_stop_overrides_aggregate_score !== true) {
    errors.push('hard-stop flags must override aggregate scores');
  }
  if (!Array.isArray(policy?.hard_stop_flags) || policy.hard_stop_flags.length < 1) {
    errors.push('hard-stop flag registry is missing');
  }
  const severity = new Map((policy?.severity_levels ?? []).map((item) => [item.id, item]));
  for (const id of ['P0', 'P1']) {
    if (severity.get(id)?.release_block !== true) errors.push(id + ' must block release');
  }
  const runtime = policy?.runtime_policy;
  if (JSON.stringify(runtime?.eligible_statuses) !== JSON.stringify(['approved']) ||
      runtime?.require_separate_versioned_runtime_grant !== true ||
      runtime?.fail_closed !== true ||
      runtime?.expert_reviewed_is_not_release_approval !== true ||
      runtime?.draft_pending_review_rework_required_rejected_retired_runtime_eligible !== false) {
    errors.push('runtime policy must fail closed and require approved status plus a separate versioned grant');
  }

  if (queue?.total_records !== 952 || queueRecords.length !== 952) {
    errors.push('redesign queue must contain exactly 952 records');
  }
  const queueIds = new Set();
  const queueSlots = new Set();
  for (const item of queueRecords) {
    if (!item || typeof item !== 'object') { errors.push('queue record must be an object'); continue; }
    if (!item.review_id || queueIds.has(item.review_id)) errors.push('missing or duplicate queue review_id');
    queueIds.add(item.review_id);
    const slot = item.topic_id + ':' + item.day_number;
    if (queueSlots.has(slot)) errors.push('duplicate queue slot ' + slot);
    queueSlots.add(slot);
    if (item.review_status !== 'pending_review' || item.runtime_eligible !== false) {
      errors.push('queue item must remain pending and runtime-blocked: ' + item.review_id);
    }
    if (!item.scores || Object.values(item.scores).some((score) => score !== null)) {
      errors.push('unreviewed queue scores must all remain null: ' + item.review_id);
    }
  }

  if (pilotRecords.length !== 25) errors.push('pilot must contain exactly 25 records');
  const pilotIds = new Set();
  const pilotSlots = new Set();
  for (const item of pilotRecords) {
    if (!item || typeof item !== 'object') { errors.push('pilot record must be an object'); continue; }
    if (!item.content_id || pilotIds.has(item.content_id)) errors.push('missing or duplicate pilot content_id');
    pilotIds.add(item.content_id);
    const slot = item.topic_id + ':' + item.day_number;
    if (pilotSlots.has(slot)) errors.push('duplicate pilot slot ' + slot);
    pilotSlots.add(slot);
    if (item.review_status !== 'draft_pending_expert_review' ||
        item.runtime_eligible !== false ||
        item.reviewer !== null ||
        item.reviewed_at !== null) {
      errors.push('pilot draft must remain unreviewed and runtime-blocked: ' + item.content_id);
    }
    if (item.evidence_mapping_status !== 'candidate_only_pending_claim_level_review') {
      errors.push('pilot evidence mapping must remain candidate-only and pending claim review: ' + item.content_id);
    }
    const ids = Array.isArray(item.evidence_ids) ? item.evidence_ids : [];
    const refs = Array.isArray(item.source_reference_ids) ? item.source_reference_ids : [];
    if (!ids.length || [...ids].sort().join('|') !== [...refs].sort().join('|')) {
      errors.push('evidence_ids and source_reference_ids must be non-empty and identical: ' + item.content_id);
    }
    for (const id of ids) {
      const source = sourceById.get(id);
      if (!source) {
        errors.push('unknown evidence source ' + id + ' in ' + item.content_id);
        continue;
      }
      for (const field of REQUIRED_EVIDENCE_FIELDS) {
        if (source[field] === undefined || source[field] === null || source[field] === '') {
          warnings.push('claim-level evidence metadata missing ' + field + ' for ' + id);
        }
      }
    }
    const queueMatches = queueRecords.filter((q) => q.topic_id === item.topic_id && q.day_number === item.day_number);
    if (queueMatches.length !== 1 ||
        queueMatches[0].draft_content_id !== item.content_id ||
        queueMatches[0].source_content_id !== item.source_content_id) {
      errors.push('pilot-to-queue mapping mismatch: ' + slot);
    }
  }

  if (evidence?.registry_id !== 'maseer28-evidence-source-registry-v1' || !sources.length) {
    errors.push('evidence registry identity or sources are missing');
  }
  return {
    valid: errors.length === 0,
    errors,
    warnings: [...new Set(warnings)],
    summary: {
      policy_dimensions: dimensions.length,
      hard_stop_flags: policy?.hard_stop_flags?.length ?? 0,
      queue_records: queueRecords.length,
      pilot_records: pilotRecords.length,
      evidence_sources: sources.length,
      runtime_eligible_pilot_records: pilotRecords.filter((item) => item?.runtime_eligible === true).length,
      claim_metadata_warnings: new Set(warnings).size
    }
  };
}

if (process.argv[1]?.endsWith('validate-quality-safety-gates.mjs')) {
  const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
  const result = validateQualitySafetyGates({
    policy: read('public/assistant/quality/content-quality-safety-gates.v1.json'),
    queue: read('public/assistant/content-drafts/952-day-redesign-queue.v1.json'),
    pilot: read('public/assistant/content-drafts/day04-08-self-evaluation-cluster-pilot.v1.json'),
    evidence: read('public/assistant/evidence/evidence-source-registry.v1.json')
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.valid) throw new Error('Quality and safety gate validation failed');
}
