const OPTIONAL_METADATA_FIELDS = Object.freeze([
  'skill',
  'mechanism',
  'lightActionVersion',
  'progressVersion',
  'progressActionVersion',
  'restVersion',
  'restActionVersion',
  'reflectionQuestion',
  'whenToSeekHumanSupport',
  'durationMinutes',
  'exerciseType',
  'riskLevel',
  'subtopic',
]);

/**
 * Normalize topic-specific source records to one stable daily-assistant schema.
 * Missing metadata stays explicit (null/empty) and is listed in metadataGaps;
 * this adapter never fabricates clinical or topic-specific content.
 */
export function normalizeDailyAssistantGuide(source = {}) {
  const subtopic = source.subtopic || source.subtopicId || null;
  const durationMinutes = source.durationMinutes ?? source.duration_minutes ?? null;
  const stopConditions = Array.isArray(source.stopConditions)
    ? source.stopConditions
    : source.stopCondition ? [source.stopCondition] : [];
  const questions = (Array.isArray(source.questions) ? source.questions : []).map((question) => Object.freeze({
    id: question.id,
    label: question.label || question.value || '',
    value: question.value || question.label || '',
    kind: question.kind || '',
    answer: typeof question.answer === 'string' ? question.answer : null,
  }));
  const normalized = {
    day: source.day ?? null,
    topicId: source.topicId || null,
    topic: source.topic || null,
    title: source.title || null,
    subtopic,
    subtopicId: source.subtopicId || subtopic,
    subtopicIds: Array.isArray(source.subtopicIds) ? source.subtopicIds : (subtopic ? [subtopic] : []),
    subtopicStatus: source.subtopicStatus || source.subtopicMappingStatus || null,
    subtopicMappingStatus: source.subtopicMappingStatus || source.subtopicStatus || null,
    objective: source.objective || null,
    skill: source.skill || null,
    mechanism: source.mechanism || null,
    exercise: source.exercise || null,
    action: source.action || null,
    lightVersion: source.lightVersion || null,
    lightActionVersion: source.lightActionVersion || null,
    progressVersion: source.progressVersion || null,
    progressActionVersion: source.progressActionVersion || null,
    restVersion: source.restVersion || null,
    restActionVersion: source.restActionVersion || null,
    successCriterion: source.successCriterion || null,
    reflectionQuestion: source.reflectionQuestion || source.reflectionPrompt || null,
    reflectionPrompt: source.reflectionPrompt || source.reflectionQuestion || null,
    stopCondition: source.stopCondition || null,
    stopConditions,
    contraindications: Array.isArray(source.contraindications) ? source.contraindications : [],
    whenToSeekHumanSupport: source.whenToSeekHumanSupport || null,
    durationMinutes,
    durationStatus: source.durationStatus || (durationMinutes == null ? 'not_recorded' : 'status_not_recorded'),
    exerciseType: source.exerciseType || null,
    riskLevel: source.riskLevel || null,
    exerciseExample: source.exerciseExample || null,
    actionExample: source.actionExample || null,
    sourceIds: Array.isArray(source.sourceIds) ? source.sourceIds : [],
    evidenceGrade: source.evidenceGrade || 'not_assessed',
    reviewStatus: source.reviewStatus || 'not_recorded',
    questions: Object.freeze(questions),
    metadataGaps: Object.freeze(OPTIONAL_METADATA_FIELDS.filter((field) => normalized[field] == null)),
  };
  return Object.freeze(normalized);
}
