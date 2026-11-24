import { getCanonicalDailyRecordId } from '../content/dailyContentSelector.js';
import { getCanonicalTopicIdForCategory } from '../journey/relationshipSafetyGate.js';
import { SHARED_DAILY_ASSISTANT_TOPIC_NAMES } from './sharedDailyAssistantEngine.js';

/**
 * Resolves the one authoritative context consumed by daily prepared answers.
 * Canonical content remains the source of identity and examples; adapted
 * guidance may replace only the fields that are visibly adapted on DayScreen.
 */
export function resolveDailyAssistantContext(dailyContext = null) {
  const source = dailyContext?.data;
  const day = Number(dailyContext?.day);
  const topicId = getCanonicalTopicIdForCategory(dailyContext?.problem) || source?.topic_id || null;
  const topicName = SHARED_DAILY_ASSISTANT_TOPIC_NAMES[topicId] || null;
  const supportedTopic = Boolean(topicName);
  const validDay = Number.isInteger(day) && day >= 1 && day <= 28;
  const canonicalIdentity = Boolean(
    supportedTopic
      && validDay
      && source
      && typeof source === 'object'
      && source.id === getCanonicalDailyRecordId(dailyContext?.problem, day)
      && Number(source.day) === day
      && (!Object.prototype.hasOwnProperty.call(source, 'topic_id')
        || source.topic_id == null
        || source.topic_id === topicId),
  );

  const guidance = dailyContext?.guidanceData;
  const guidanceMatchesSource = Boolean(
    source
      && (!guidance?.id || guidance.id === source.id)
      && (guidance?.day == null || Number(guidance.day) === Number(source.day))
      && (!guidance?.topic_id || !source.topic_id || guidance.topic_id === source.topic_id),
  );

  let visibleContent = source && typeof source === 'object' ? { ...source } : null;
  if (visibleContent && guidance && guidanceMatchesSource) {
    visibleContent = {
      ...source,
      ...guidance,
      // Identity and examples always come from the canonical record.
      id: source.id,
      topic_id: source.topic_id,
      day: source.day,
      title: guidance.title || source.title,
      sourceExercise: source.exercise || source.instructions,
      sourceActionText: source.actionText || source.action,
      exercise: guidance.exercise || source.exercise || source.instructions,
      actionText: guidance.action || source.actionText || source.action,
      exerciseExample: source.exerciseExample || guidance.exerciseExample || '',
      actionExample: source.actionExample || guidance.actionExample || '',
      lightExerciseText: source.lightExerciseText || guidance.lightExerciseText,
      lightActionText: source.lightActionText || guidance.lightActionText,
      progressActionText: source.progressActionText || guidance.progressActionText,
      restExerciseText: source.restExerciseText || guidance.restExerciseText,
      restActionText: source.restActionText || guidance.restActionText,
    };
  } else if (visibleContent && guidance && !guidanceMatchesSource) {
    // Ignore stale/mismatched adaptation, but retain the verified canonical
    // record. Returning null here caused T01 to fall back to its old answer
    // bank while the day screen still showed canonical content.
    visibleContent = { ...source };
  }

  return Object.freeze({
    day,
    topicId,
    topicName,
    supportedTopic,
    canonicalIdentity,
    source,
    visibleContent: visibleContent ? Object.freeze(visibleContent) : null,
  });
}
