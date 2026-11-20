export function validateDailyEvidenceSource(day, evidenceRegistry) {
  if (!day || typeof day !== 'object') return { valid: false, reason: 'invalid_daily_record' };
  const sourceIds = Array.isArray(day.source_ids) ? day.source_ids : [];
  const registered = new Set((evidenceRegistry?.sources || []).map((source) => source.source_id));
  const evidenceAssessed = day.evidence_grade !== undefined
    && day.evidence_grade !== null
    && day.evidence_grade !== ''
    && day.evidence_grade !== 'not_assessed';
  if (evidenceAssessed && sourceIds.length === 0) {
    return { valid: false, reason: 'source_ids_required_for_assessed_evidence' };
  }
  if (sourceIds.some((id) => !registered.has(id))) {
    return { valid: false, reason: 'source_ids_must_exist_in_evidence_registry' };
  }
  return { valid: true, reason: null };
}
