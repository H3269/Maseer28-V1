export function getDailySafetyMode(day) {
  if (!day || typeof day !== 'object') return 'routine';
  // Risk metadata is not an approval. Any v2 record must carry an explicit
  // approved review state; missing, draft, or pending review fails closed.
  const hasReviewStatus = Object.prototype.hasOwnProperty.call(day, 'review_status');
  const hasRiskLevel = Object.prototype.hasOwnProperty.call(day, 'risk_level');
  if ((hasReviewStatus && day.review_status !== 'approved') || (hasRiskLevel && !hasReviewStatus)) {
    return 'blocked';
  }
  const level = day.risk_level;
  if (level === null || level === undefined || level === '') {
    // Legacy records have no v2 metadata. A partially migrated v2 record must
    // fail closed rather than silently defaulting to routine.
    return day.review_status || day.topic_id || Array.isArray(day.source_ids) ? 'blocked' : 'routine';
  }
  if (level === 'routine') return 'routine';
  if (level === 'caution') return 'caution';
  return 'blocked';
}

export function createHumanReviewSkipRecord(day, timestamp = new Date()) {
  if (getDailySafetyMode(day) !== 'blocked') {
    throw new Error('Only blocked or unapproved daily content can be skipped through this path.');
  }
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (!Number.isFinite(date.getTime())) throw new Error('A valid skip timestamp is required.');
  return {
    status: 'skipped_human_review',
    feedbackText: 'این تمرین به دلیل نیاز به بازبینی انسانی اجرا نشد. هیچ امتیازی ثبت نشده و این ثبت به معنی بهبود یا بدترشدن نیست.',
    exerciseId: typeof day.id === 'string' ? day.id.slice(0, 200) : '',
    updatedAt: date.toISOString(),
  };
}
