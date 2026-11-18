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

function topicIs(day, topicId, legacyPattern) {
  return Boolean(day && typeof day === 'object' && (
    day.topic_id === topicId || legacyPattern.test(String(day.id || ''))
  ));
}
const isFearTopicDay = (day) => topicIs(day, 'T03', /^(?:ترس-[0-9]{1,2}|T03-D[0-9]{1,2})$/iu);
const isBoundaryTopicDay = (day) => topicIs(day, 'T12', /^(?:مرزبندی و نه گفتن-[0-9]{1,2}|T12-D[0-9]{1,2})$/u);
const isSleepTopicDay = (day) => topicIs(day, 'T10', /^(?:بی‌خوابی و مشکلات خواب-[0-9]{1,2}|T10-D[0-9]{1,2})$/u);
const isLonelinessDayFourteen = (day) => Boolean(day && typeof day === 'object' && (
  (day.topic_id === 'T13' && Number(day.day) === 14)
  || /^تنهایی-14$/u.test(String(day.id || ''))
  || /^T13-D14$/i.test(String(day.id || ''))
));
const isLowEnergyTopicDay = (day) => topicIs(day, 'T32', /^(?:بی‌انگیزگی-[0-9]{1,2}|T32-D[0-9]{1,2})$/u);
const isRepetitiveNegativeThinkingTopicDay = (day) => topicIs(day, 'T16', /^(?:افکار منفی و نشخوار فکری-[0-9]{1,2}|T16-D[0-9]{1,2})$/u);
const isRelationshipDifficultiesTopicDay = (day) => topicIs(day, 'T17', /^(?:مشکلات رابطه-[0-9]{1,2}|T17-D[0-9]{1,2})$/u);
const isRepetitiveBehaviorTopicDay = (day) => topicIs(day, 'T11', /^(?:عادت‌های تکراری-(?:0[1-9]|1[0-9]|2[0-8])|T11-D(?:0[1-9]|1[0-9]|2[0-8]))$/u);

function hasSubtopic(day, allowed) {
  return Array.isArray(day?.subtopic_ids)
    && day.subtopic_ids.length === 1
    && allowed.has(day.subtopic_ids[0]);
}
function hasSafetyRules(day) {
  return Array.isArray(day?.safety_rule_ids) && day.safety_rule_ids.length > 0;
}
function riskMode(day) {
  const level = day?.risk_level;
  if (level === 'human_review_required' || level === 'high' || level === 'moderate') return 'blocked';
  if (level === 'caution') return 'caution';
  if (level === 'routine' || level === undefined || level === null || level === '') return 'routine';
  return 'caution';
}

export function getDailySafetyMode(day) {
  if (!day || typeof day !== 'object') return 'routine';

  if (isRepetitiveBehaviorTopicDay(day)) return riskMode(day);

  if (isFearTopicDay(day)) {
    if (Number(day.day) === 14 && (day.risk_level !== 'caution' || !hasSafetyRules(day))) return 'blocked';
    return riskMode(day);
  }

  if (isBoundaryTopicDay(day)) {
    if (Array.isArray(day.subtopic_ids) && day.subtopic_ids.includes('T12-S03')) {
      return day.risk_level === 'caution' ? 'caution' : 'blocked';
    }
    return riskMode(day);
  }

  if (isSleepTopicDay(day)) {
    if (hasSubtopic(day, new Set(['T10-S03']))) {
      return day.risk_level === 'caution' && hasSafetyRules(day) ? 'caution' : 'blocked';
    }
    return riskMode(day);
  }

  if (isLonelinessDayFourteen(day)) return riskMode(day);

  if (isLowEnergyTopicDay(day) && hasSubtopic(day, new Set(['T32-S03']))) {
    return day.risk_level === 'caution' && hasSafetyRules(day) ? 'caution' : 'blocked';
  }

  if (isRepetitiveNegativeThinkingTopicDay(day)
    && hasSubtopic(day, new Set(['T16-S03'])) && !hasSafetyRules(day)) return 'blocked';

  if (isRelationshipDifficultiesTopicDay(day)
    && hasSubtopic(day, new Set(['T17-S03']))
    && (day.risk_level !== 'caution' || !hasSafetyRules(day))) return 'blocked';

  if (isControlTopicDay(day) && !getControlContextForDay(day)) return 'blocked';

  return riskMode(day);
}
