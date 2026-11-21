// Explicit owner-controlled allowlist for daily content visible in the app.
// Empty by default: no T01-T14 daily unit is released until Dr. Abedi approves
// that exact canonical daily record. Specialist/review metadata is never enough.
const OWNER_APPROVED_DAILY_RECORD_IDS = new Set([
  // Add canonical IDs (for example: "خشم-01") only after explicit owner approval.
]);

export function requiresOwnerApproval(topicId) {
  return /^T(?:0[1-9]|1[0-4])$/u.test(String(topicId || '').trim());
}

export function isOwnerApprovedDailyRecord({ topicId, recordId } = {}) {
  if (!requiresOwnerApproval(topicId)) return true;
  return typeof recordId === 'string'
    && OWNER_APPROVED_DAILY_RECORD_IDS.has(recordId.trim());
}
