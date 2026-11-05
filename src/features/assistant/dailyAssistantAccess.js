import { getDailySafetyMode } from '../content/dailySafety.js';
import { getRelationshipSafetyGate } from '../journey/relationshipSafetyGate.js';

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
  const hasV2Identity = typeof day.id === 'string' && day.id.trim() !== ''
    && typeof day.topic_id === 'string' && /^T(?:0[1-9]|[12][0-9]|3[0-4])$/u.test(day.topic_id.trim())
    && hasValidDayNumber;
  // Legacy records have no v2 identity fields. Verify their exact canonical
  // category key + zero-padded day ID instead of fabricating a topic_id.
  const isUnmigratedLegacy = !Object.prototype.hasOwnProperty.call(day, 'topic_id')
    && !Object.prototype.hasOwnProperty.call(day, 'review_status')
    && !Object.prototype.hasOwnProperty.call(day, 'risk_level');
  const legacyTopic = typeof problem === 'string' ? problem.trim() : '';
  const hasVerifiedLegacyIdentity = isUnmigratedLegacy
    && legacyTopic.length > 0
    && typeof day.id === 'string'
    && hasValidDayNumber
    && day.id === `${legacyTopic}-${String(dayNumber).padStart(2, '0')}`;
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
