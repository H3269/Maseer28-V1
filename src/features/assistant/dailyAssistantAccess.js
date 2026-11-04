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

  return Object.freeze({
    available: true,
    reason: null,
    safetyMode,
    requiresCaution: safetyMode === 'caution',
  });
}
