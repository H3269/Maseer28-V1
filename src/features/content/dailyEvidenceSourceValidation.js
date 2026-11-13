export function validateDailyEvidenceSourceIds(day, evidenceSourceIds) {
  if (!Array.isArray(day?.source_ids)) {
    return { valid: false, reason: 'source_ids_must_be_an_array' };
  }

  const invalidIds = day.source_ids.filter((id) => typeof id !== 'string' || !evidenceSourceIds.has(id));
  if (invalidIds.length > 0) {
    return { valid: false, reason: 'source_ids_not_in_registry', invalidIds };
  }

  const evidenceAssessed = day.evidence_grade !== 'not_assessed';
  const approved = day.review_status === 'approved';
  if ((approved || evidenceAssessed) && day.source_ids.length === 0) {
    return { valid: false, reason: 'source_ids_required_for_assessed_or_approved_content' };
  }

  return {
    valid: true,
    reason: day.source_ids.length > 0 ? 'claim_sources_linked' : 'draft_or_unassessed_without_claim_links',
  };
}
