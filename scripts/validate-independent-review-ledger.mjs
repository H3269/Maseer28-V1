import { createHash } from 'node:crypto';

const DIMENSIONS = ['A','B','C','D','E','F','G','H'];
const SEVERITIES = new Set(['P0','P1','P2','P3']);
const DECISIONS = new Set(['rework','reject','hold','expert_reviewed','approved']);

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonEmpty = (value) => typeof value === 'string' && value.trim().length > 0;
const canonical = (value) => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']' :
  isObject(value) ? '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}' : JSON.stringify(value);
const digest = (value) => 'sha256:' + createHash('sha256').update(canonical(value)).digest('hex');
const hasAllScores = (scores) => isObject(scores) && DIMENSIONS.every((key) =>
  Number.isInteger(scores[key]) && scores[key] >= 0 && scores[key] <= 4);

export function validateIndependentReviewLedger(ledger) {
  const errors = [];
  const records = Array.isArray(ledger?.records) ? ledger.records : [];
  const events = Array.isArray(ledger?.event_log) ? ledger.event_log : [];
  if (ledger?.schema_version !== '1.0.0') errors.push('ledger schema_version must be 1.0.0');
  if (ledger?.ledger_id !== 'maseer28-independent-content-review-ledger-v1') errors.push('ledger identity is invalid');
  const blind = ledger?.blind_review_policy;
  if (blind?.review_model !== 'single_authorized_owner_expert_review' ||
      blind?.required_reviewers !== 1 || blind?.independent !== false ||
      blind?.no_prepopulated_scores_or_reviewer_identity !== true) errors.push('owner-expert review policy is weakened');
  if (ledger?.governance?.release_score_threshold !== null ||
      ledger?.governance?.disagreement_resolution !== 'owner_expert_documents_final_decision; optional_peer_input_is_advisory' ||
      ledger?.governance?.decision_authority !== 'authorized_product_owner_or_designated_expert' ||
      ledger?.governance?.runtime_requires !== 'approved_record_and_separate_versioned_runtime_grant') {
    errors.push('review governance or fail-closed runtime policy is weakened');
  }
  const recordIds = new Set();
  const eventIds = new Set();
  for (const record of records) {
    if (!isObject(record) || !nonEmpty(record.content_id) || recordIds.has(record.content_id)) {
      errors.push('review record has missing or duplicate content_id'); continue;
    }
    recordIds.add(record.content_id);
    if (!nonEmpty(record.content_version) || !nonEmpty(record.topic_id) ||
        !Number.isInteger(record.day_number) || record.day_number < 1) errors.push('record identity/version fields are incomplete: ' + record.content_id);
    const reviews = Array.isArray(record.reviews) ? record.reviews : [];
    if (reviews.length > 1) errors.push('one authorized owner-expert review is required; optional peer input is advisory and not a second approval: ' + record.content_id);
    const reviewers = new Set();
    for (const review of reviews) {
      if (!nonEmpty(review.reviewer_id) || reviewers.has(review.reviewer_id)) errors.push('owner-expert reviewer ID must be present and unique: ' + record.content_id);
      reviewers.add(review.reviewer_id);
      if (review.status !== 'submitted') errors.push('only submitted immutable reviews belong in the ledger: ' + record.content_id);
      if (!hasAllScores(review.scores)) errors.push('submitted review must contain A-H scores from 0 to 4: ' + record.content_id);
      if (!isObject(review.reviewer_qualification) || !nonEmpty(review.reviewer_qualification.credential_basis) ||
          !nonEmpty(review.reviewer_qualification.scope) || !nonEmpty(review.reviewer_qualification.verified_by)) {
        errors.push('reviewer qualification must be documented and independently verified: ' + record.content_id);
      }
      if (typeof review.conflict_of_interest?.declared !== 'boolean' ||
          (review.conflict_of_interest.declared === true && !nonEmpty(review.conflict_of_interest.details))) {
        errors.push('conflict-of-interest declaration is incomplete: ' + record.content_id);
      }
      if (!nonEmpty(review.submitted_at) || !Array.isArray(review.findings) ||
          !Array.isArray(review.hard_stop_flags) || !Array.isArray(review.evidence_claim_reviews)) {
        errors.push('review findings, evidence checks, safety flags and timestamp are required: ' + record.content_id);
      }
      for (const finding of review.findings ?? []) {
        if (!SEVERITIES.has(finding.severity) || !nonEmpty(finding.finding_id) ||
            !nonEmpty(finding.location) || !nonEmpty(finding.rationale) ||
            typeof finding.resolved !== 'boolean') errors.push('finding schema invalid: ' + record.content_id);
      }
    }
        if (record.decision === 'approved' || record.decision === 'expert_reviewed') {
      if (reviews.length !== 1) errors.push('one submitted authorized owner-expert review is required before expert decision: ' + record.content_id);
      if (reviews.some((r) => r.hard_stop_flags.length > 0 ||
          r.findings.some((f) => ['P0','P1'].includes(f.severity) && f.resolved !== true))) {
        errors.push('open hard-stop/P0/P1 finding blocks expert decision: ' + record.content_id);
      }
      if (reviews.some((r) => DIMENSIONS.some((key) => r.scores[key] <= 1))) errors.push('score 0 or 1 blocks approval pending rework and review: ' + record.content_id);
      if (!nonEmpty(record.decision_rationale) || !nonEmpty(record.decided_at)) errors.push('decision rationale and timestamp are required: ' + record.content_id);
    }
    if (!DECISIONS.has(record.decision)) errors.push('record decision is missing or invalid: ' + record.content_id);
    if (record.runtime_eligible === true) {
      const grant = record.runtime_grant;
      if (record.decision !== 'approved' || !isObject(grant) ||
          !nonEmpty(grant.grant_id) || !nonEmpty(grant.content_version) ||
          grant.content_version !== record.content_version || !nonEmpty(grant.approved_by) ||
          !nonEmpty(grant.issued_at) || !nonEmpty(grant.expires_at)) {
        errors.push('runtime requires approved exact-version record and separate time-bounded grant: ' + record.content_id);
      }
    }
  }
  let previousId = null;
  let previousHash = 'GENESIS';
  events.forEach((event, index) => {
    if (!nonEmpty(event.event_id) || eventIds.has(event.event_id)) errors.push('event IDs must be unique');
    eventIds.add(event.event_id);
    const { event_hash, ...hashableEvent } = event;
    if (event.sequence !== index + 1 || event.previous_event_id !== previousId ||
        event.previous_event_hash !== previousHash || !nonEmpty(event.event_type) ||
        !nonEmpty(event.actor_id) || !nonEmpty(event.occurred_at) || !nonEmpty(event.payload_digest) ||
        event_hash !== digest(hashableEvent)) errors.push('append-only hash chain is invalid at sequence ' + (index + 1));
    previousId = event.event_id;
    previousHash = event_hash ?? null;
  });
  return { valid: errors.length === 0, errors, summary: {
    records: records.length, records_with_owner_expert_review: records.filter((r) => r.reviews?.length === 1).length,
    approved_records: records.filter((r) => r.decision === 'approved').length,
    runtime_eligible_records: records.filter((r) => r.runtime_eligible === true).length,
    audit_events: events.length
  }};
}
