import { getDailySafetyMode } from '../content/dailySafety.js';
import { getCanonicalDailyRecordId } from '../content/dailyContentSelector.js';
import { getCanonicalTopicIdForCategory, getRelationshipSafetyGate } from '../journey/relationshipSafetyGate.js';

export function getDailyAssistantAccess({ day, problem, relationshipSafetyConfirmed = false } = {}) {
  if (!day || typeof day !== 'object') {
    return Object.freeze({ available: false, reason: 'day_unavailable', safetyMode: 'blocked' });
  }

  const safetyMode = getDailySafetyMode(day);
  if (safetyMode === 'blocked') {
    return Object.freeze({ available: false, reason: 'daily_content_blocked', safetyMode });
  }

  if (getRelationshipSafetyGate(day) && relationshipSafetyConfirmed !== true) {
    return Object.freeze({ available: false, reason: 'relationship_safety_unconfirmed', safetyMode });
  }

  const dayNumber = Number(day.day);
  const hasValidDayNumber = Number.isInteger(dayNumber) && dayNumber >= 1 && dayNumber <= 28;
  const legacyTopic = typeof problem === 'string' ? problem.trim() : '';
  const expectedId = hasValidDayNumber
    ? getCanonicalDailyRecordId(legacyTopic, dayNumber)
    : null;
  const hasCanonicalId = typeof day.id === 'string' && expectedId !== null && day.id === expectedId;
  const expectedTopicId = getCanonicalTopicIdForCategory(legacyTopic);
  const hasV2Identity = hasCanonicalId
    && typeof day.topic_id === 'string'
    && /^T(?:0[1-9]|[12][0-9]|3[0-4])$/u.test(day.topic_id.trim())
    && day.topic_id.trim() === expectedTopicId;
  // Legacy records have no v2 identity fields. Their exact category key and
  // zero-padded day ID are sufficient; never synthesize v2 metadata.
  const isUnmigratedLegacy = !Object.prototype.hasOwnProperty.call(day, 'topic_id')
    && !Object.prototype.hasOwnProperty.call(day, 'review_status')
    && !Object.prototype.hasOwnProperty.call(day, 'risk_level');
  const hasVerifiedLegacyIdentity = isUnmigratedLegacy && hasCanonicalId;
  const hasVerifiedIdentity = hasV2Identity || hasVerifiedLegacyIdentity;
  if (!hasVerifiedIdentity) {
    return Object.freeze({ available: false, reason: 'daily_source_identity_unverified', safetyMode: 'blocked' });
  }

  return Object.freeze({
    available: true,
    reason: null,
    safetyMode,
    requiresCaution: safetyMode === 'caution',
  });
}
