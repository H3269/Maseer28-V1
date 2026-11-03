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

function isFearTopicDay(day) {
  if (!day || typeof day !== 'object') return false;
  const id = String(day.id || '');
  return day.topic_id === 'T03'
    || /^ترس-[0-9]{1,2}$/u.test(id)
    || /^T03-D[0-9]{1,2}$/i.test(id);
}

const FEAR_SUBTOPIC_IDS = new Set(['T03-S01', 'T03-S02', 'T03-S03']);

function hasApprovedFearReview(day) {
  const requiredText = [
    'learning_objective', 'target_skill', 'teaching_point',
    'exercise_type', 'instructions', 'reflection_prompt',
    'success_criterion', 'when_to_seek_human_support',
  ];
  if (day.review_status !== 'approved'
    || day.topic_id !== 'T03'
    || !Array.isArray(day.subtopic_ids)
    || day.subtopic_ids.length !== 1
    || !FEAR_SUBTOPIC_IDS.has(day.subtopic_ids[0])
    || !Number.isInteger(day.duration_minutes)
    || day.duration_minutes < 1
    || day.duration_minutes > 60
    || !Array.isArray(day.stop_conditions)
    || day.stop_conditions.length === 0
    || !Array.isArray(day.contraindications)
    || day.contraindications.length === 0
    || !Array.isArray(day.source_ids)
    || day.source_ids.length === 0
    || !['not_assessed', 'very_low', 'low', 'moderate', 'high'].includes(day.evidence_grade)
    || typeof day.review_record_id !== 'string'
    || !day.review_record_id.trim()
    || typeof day.reviewer_name !== 'string'
    || !day.reviewer_name.trim()
    || !['qualified_clinician', 'evidence_reviewer', 'safety_reviewer'].includes(day.reviewer_role)
    || !day.reviewed_at
    || !Number.isFinite(Date.parse(day.reviewed_at))
    || requiredText.some((field) => typeof day[field] !== 'string' || !day[field].trim())) {
    return false;
  }

  // Day 14's generic behavior-reduction instruction needs an explicit,
  // reviewed safety rule and caution classification after redesign.
  if (Number(day.day) === 14) {
    return day.risk_level === 'caution'
      && Array.isArray(day.safety_rule_ids)
      && day.safety_rule_ids.length > 0;
  }
  return true;
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

function isSleepTopicDay(day) {
  return Boolean(day && typeof day === 'object' && (
    day.topic_id === 'T10'
    || /^بی‌خوابی و مشکلات خواب-[0-9]{1,2}$/u.test(String(day.id || ''))
    || /^T10-D[0-9]{1,2}$/i.test(String(day.id || ''))
  ));
}

function isLonelinessDayFourteen(day) {
  return Boolean(day && typeof day === 'object' && (
    (day.topic_id === 'T13' && Number(day.day) === 14)
    || /^تنهایی-14$/u.test(String(day.id || ''))
    || /^T13-D14$/i.test(String(day.id || ''))
  ));
}

function isLowEnergyTopicDay(day) {
  return Boolean(day && typeof day === 'object' && (
    day.topic_id === 'T32'
    || /^بی‌انگیزگی-[0-9]{1,2}$/u.test(String(day.id || ''))
    || /^T32-D[0-9]{1,2}$/i.test(String(day.id || ''))
  ));
}

function isRepetitiveNegativeThinkingTopicDay(day) {
  return Boolean(day && typeof day === 'object' && (
    day.topic_id === 'T16'
    || /^افکار منفی و نشخوار فکری-[0-9]{1,2}$/u.test(String(day.id || ''))
    || /^T16-D[0-9]{1,2}$/i.test(String(day.id || ''))
  ));
}

const RNT_SUBTOPIC_IDS = new Set(['T16-S01', 'T16-S02', 'T16-S03']);

function hasApprovedRntReview(day) {
  return day.review_status === 'approved'
    && Array.isArray(day.subtopic_ids)
    && day.subtopic_ids.length === 1
    && RNT_SUBTOPIC_IDS.has(day.subtopic_ids[0])
    && typeof day.review_record_id === 'string'
    && day.review_record_id.trim().length > 0
    && Array.isArray(day.safety_rule_ids)
    && day.safety_rule_ids.length > 0;
}

const LOW_ENERGY_SUBTOPIC_IDS = new Set(['T32-S01', 'T32-S02', 'T32-S03']);

function hasApprovedLowEnergyReview(day) {
  if (day.review_status !== 'approved'
    || !Array.isArray(day.subtopic_ids)
    || day.subtopic_ids.length !== 1
    || !LOW_ENERGY_SUBTOPIC_IDS.has(day.subtopic_ids[0])
    || typeof day.review_record_id !== 'string'
    || day.review_record_id.trim().length === 0) return false;

  if (day.subtopic_ids[0] === 'T32-S03') {
    return day.risk_level === 'caution'
      && Array.isArray(day.safety_rule_ids)
      && day.safety_rule_ids.length > 0;
  }
  return true;
}

const LONELINESS_SUBTOPIC_IDS = new Set(['T13-S01', 'T13-S02', 'T13-S03']);

function hasApprovedLonelinessDayFourteenReview(day) {
  return day.topic_id === 'T13'
    && Number(day.day) === 14
    && day.review_status === 'approved'
    && Array.isArray(day.subtopic_ids)
    && day.subtopic_ids.length === 1
    && LONELINESS_SUBTOPIC_IDS.has(day.subtopic_ids[0])
    && typeof day.review_record_id === 'string'
    && day.review_record_id.trim().length > 0
    && day.risk_level === 'caution'
    && Array.isArray(day.safety_rule_ids)
    && day.safety_rule_ids.length > 0;
}

const SLEEP_SUBTOPIC_IDS = new Set(['T10-S01', 'T10-S02', 'T10-S03']);

function hasApprovedSleepReview(day) {
  if (day.review_status !== 'approved'
    || !Array.isArray(day.subtopic_ids)
    || day.subtopic_ids.length !== 1
    || !SLEEP_SUBTOPIC_IDS.has(day.subtopic_ids[0])
    || typeof day.review_record_id !== 'string'
    || day.review_record_id.trim().length === 0) return false;

  if (day.subtopic_ids[0] === 'T10-S03') {
    return day.risk_level === 'caution'
      && Array.isArray(day.safety_rule_ids)
      && day.safety_rule_ids.length > 0;
  }
  return true;
}

export function getDailySafetyMode(day) {
  if (!day || typeof day !== 'object') return 'routine';
  if (isFearTopicDay(day) && !hasApprovedFearReview(day)) return 'blocked';
  if (isRepetitiveBehaviorTopicDay(day) && !hasApprovedRepetitiveBehaviorReview(day)) return 'blocked';
  if (isBoundaryTopicDay(day) && !hasApprovedBoundaryReview(day)) return 'blocked';
  if (isSleepTopicDay(day) && !hasApprovedSleepReview(day)) return 'blocked';
  if (isLonelinessDayFourteen(day) && !hasApprovedLonelinessDayFourteenReview(day)) return 'blocked';
  if (isLowEnergyTopicDay(day) && !hasApprovedLowEnergyReview(day)) return 'blocked';
  if (isRepetitiveNegativeThinkingTopicDay(day) && !hasApprovedRntReview(day)) return 'blocked';
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
