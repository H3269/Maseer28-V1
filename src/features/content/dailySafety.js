const LEGACY_CONTROL_TOPIC_ID = /^کنترل‌گری-[0-9]{1,2}$/u;
const CANONICAL_CONTROL_TOPIC_ID = /^T31-D[0-9]{1,2}$/i;
const CONTROL_CONTEXT_BY_SUBTOPIC = new Map([
  ['T31-S01', 'self_control_need'],
  ['T31-S02', 'interpersonal_coercive_control'],
  ['T31-S03', 'relationship_power_safety'],
]);

export function isControlTopicDay(day) {
  return Boolean(day && typeof day === 'object' && (
    day.topic_id === 'T31'
    || LEGACY_CONTROL_TOPIC_ID.test(String(day.id || ''))
    || CANONICAL_CONTROL_TOPIC_ID.test(String(day.id || ''))
  ));
}

export function getControlContextForDay(day) {
  if (!isControlTopicDay(day)) return null;
  const subtopicIds = Array.isArray(day.subtopic_ids) ? day.subtopic_ids : [];
  if (subtopicIds.length !== 1) return null;
  const expectedContext = CONTROL_CONTEXT_BY_SUBTOPIC.get(subtopicIds[0]);
  return expectedContext && day.control_context === expectedContext ? expectedContext : null;
}

function isFearTopicDayFourteen(day) {
  if (!day || typeof day !== 'object') return false;
  const id = String(day.id || '');
  // T03-D14 contains an unqualified instruction to reduce a possibly
  // protective behavior. Block legacy and canonical identities regardless
  // of a conflicting day field or a later routine/approved risk label.
  return day.topic_id === 'T03' && Number(day.day) === 14
    || /^ترس-14$/u.test(id)
    || /^T03-D14$/i.test(id);
}

function isRepetitiveBehaviorTopicDay(day) {
  return Boolean(day && typeof day === 'object' && (
    day.topic_id === 'T11'
    || /^عادت‌های تکراری-[0-9]{1,2}$/u.test(String(day.id || ''))
    || /^T11-D[0-9]{1,2}$/i.test(String(day.id || ''))
  ));
}

// Only simple context-dependent habits can use the generic daily path. BFRB/OCD/tic/developmental patterns stay withheld until their taxonomy and interventions are separated.
const REPETITIVE_BEHAVIOR_SUBTOPIC_IDS = new Set(['T11-S01']);

function hasApprovedRepetitiveBehaviorReview(day) {
  return day.review_status === 'approved'
    && Array.isArray(day.subtopic_ids)
    && day.subtopic_ids.length === 1
    && REPETITIVE_BEHAVIOR_SUBTOPIC_IDS.has(day.subtopic_ids[0])
    && typeof day.review_record_id === 'string'
    && day.review_record_id.trim().length > 0;
}

function isBoundaryTopicDay(day) {
  return Boolean(day && typeof day === 'object' && (
    day.topic_id === 'T12'
    || /^مرزبندی و نه گفتن-[0-9]{1,2}$/u.test(String(day.id || ''))
    || /^T12-D[0-9]{1,2}$/i.test(String(day.id || ''))
  ));
}

const BOUNDARY_SUBTOPIC_IDS = new Set(['T12-S01', 'T12-S02', 'T12-S03']);

function hasApprovedBoundaryReview(day) {
  if (day.review_status !== 'approved'
    || !Array.isArray(day.subtopic_ids)
    || day.subtopic_ids.length !== 1
    || !BOUNDARY_SUBTOPIC_IDS.has(day.subtopic_ids[0])
    || typeof day.review_record_id !== 'string'
    || day.review_record_id.trim().length === 0) return false;

  if (day.subtopic_ids[0] === 'T12-S03') {
    return day.risk_level === 'caution'
      && Array.isArray(day.safety_rule_ids)
      && day.safety_rule_ids.length > 0;
  }
  return true;
}

export function getDailySafetyMode(day) {
  if (!day || typeof day !== 'object') return 'routine';
  if (isFearTopicDayFourteen(day)) return 'blocked';
  if (isRepetitiveBehaviorTopicDay(day) && !hasApprovedRepetitiveBehaviorReview(day)) return 'blocked';
  if (isBoundaryTopicDay(day) && !hasApprovedBoundaryReview(day)) return 'blocked';
  if (isControlTopicDay(day)) {
    // "Control" conflates personal over-control with interpersonal coercive
    // control. Release only after an approved day is assigned to exactly one
    // explicit subtype; approval alone must not erase that distinction.
    if (day.review_status !== 'approved' || !getControlContextForDay(day)) return 'blocked';
  }

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
