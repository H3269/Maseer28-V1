import { getDailySafetyMode } from '../content/dailySafety.js';
import { getRelationshipSafetyGate } from '../journey/relationshipSafetyGate.js';

export function getDailyAssistantAccess({ day, relationshipSafetyConfirmed = false } = {}) {
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

  const hasVerifiedIdentity = typeof day.id === 'string' && day.id.trim() !== ''
    && typeof day.topic_id === 'string' && /^T(?:0[1-9]|[12][0-9]|3[0-4])$/u.test(day.topic_id.trim())
    && Number.isInteger(Number(day.day)) && Number(day.day) >= 1 && Number(day.day) <= 28;
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
