import { buildSharedDailyAssistantAnswer } from './sharedDailyAssistantEngine.js';

/**
 * T01 keeps its approved response-bank entry point, but delegates to the
 * single shared daily-answer engine used by the other supported topics.
 */
export function buildAngerDailyRebuiltAnswer(args = {}) {
  return buildSharedDailyAssistantAnswer(args);
}
