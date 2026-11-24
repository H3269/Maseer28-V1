import { answerAngerDailyPreparedQuestion } from './angerDailyAssistantPrompts.js';
import { buildSharedDailyAssistantAnswerFromDailyContent } from './sharedDailyAssistantEngine.js';

/**
 * Single entry point for prepared daily answers.
 * T01 keeps its approved guide-data adapter; every topic delegates the final
 * response body to the shared daily-answer renderer.
 */
export function buildPreparedDailyAssistantAnswer({
  topicId,
  topicName,
  day,
  message,
  dailyContent,
} = {}) {
  if (topicId === 'T01') {
    return answerAngerDailyPreparedQuestion({ day, message, dailyContent });
  }

  return buildSharedDailyAssistantAnswerFromDailyContent({
    topicId,
    topicName,
    day,
    message,
    dailyContent,
  });
}
