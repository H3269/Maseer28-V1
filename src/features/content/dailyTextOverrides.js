const RUNTIME_TEXT_FIELDS = Object.freeze([
  'title', 'intro', 'exercise', 'actionText', 'closing',
  'lightExerciseText', 'lightActionText', 'progressActionText',
  'restExerciseText', 'restActionText',
]);

const T11_RUNTIME_METADATA_FIELDS = Object.freeze([
  'objective', 'skill', 'mechanism', 'lightVersion', 'progressVersion', 'restVersion',
  'successCriterion', 'reflectionQuestion', 'stopCondition', 'stopConditions',
  'contraindications', 'whenToSeekHumanSupport', 'durationMinutes', 'durationStatus',
  'exerciseType', 'riskLevel', 'sourceIds', 'evidenceGrade',
  'subtopicId', 'subtopicIds', 'subtopicMappingStatus', 'duration_minutes',
  'duration_status', 'exercise_type', 'risk_level', 'source_ids', 'evidence_grade',
  'subtopic_ids', 'subtopic_mapping_status', 'stop_conditions',
  'when_to_seek_human_support',
]);


const T07_RUNTIME_METADATA_FIELDS = Object.freeze([
  'topic_id', 'objective', 'skill', 'mechanism', 'learning_objective', 'target_skill', 'teaching_point',
  'exercise_type', 'duration_minutes', 'duration_status', 'risk_level', 'evidence_grade', 'instructions',
  'source_ids', 'subtopic_ids', 'success_criterion', 'reflection_prompt', 'stop_condition_text',
  'stop_conditions', 'contraindications', 'when_to_seek_human_support',
]);

const T08_RUNTIME_METADATA_FIELDS = Object.freeze([
  'topic_id', 'objective', 'skill', 'mechanism', 'learning_objective', 'target_skill', 'teaching_point',
  'exercise_type', 'duration_minutes', 'duration_status', 'risk_level', 'evidence_grade',
  'source_ids', 'subtopic_ids', 'success_criterion', 'reflection_prompt', 'stop_condition_text',
  'stop_conditions', 'contraindications', 'when_to_seek_human_support',
]);

const T12_RUNTIME_METADATA_FIELDS = Object.freeze([
  'topic_id', 'objective', 'skill', 'subtopic_ids', 'risk_level',
  'successCriterion', 'reflectionQuestion', 'stopCondition', 'stopConditions',
  'contraindications', 'whenToSeekHumanSupport', 'exerciseType', 'stop_conditions', 'when_to_seek_human_support',
  'success_criterion', 'reflection_prompt', 'exercise_type',
]);

export function mergeDailyTextOverrides(content, overrides) {
  if (!content || typeof content !== 'object' || !overrides || typeof overrides !== 'object') {
    return content;
  }

  const baseCategories = content.categories;
  const overrideCategories = overrides.categories;
  if (!baseCategories || typeof baseCategories !== 'object'
    || !overrideCategories || typeof overrideCategories !== 'object') {
    return content;
  }

  const categories = { ...baseCategories };
  for (const [categoryKey, overrideCategory] of Object.entries(overrideCategories)) {
    const baseCategory = categories[categoryKey];
    if (!baseCategory || !Array.isArray(baseCategory.days) || !Array.isArray(overrideCategory?.days)) {
      continue;
    }

    const overridesByDay = new Map(
      overrideCategory.days
        .filter((item) => Number.isInteger(Number(item?.day)))
        .map((item) => [Number(item.day), item])
    );

    categories[categoryKey] = {
      ...baseCategory,
      days: baseCategory.days.map((day) => {
        const replacement = overridesByDay.get(Number(day?.day));
        if (!replacement) return day;
        const textOverrides = Object.fromEntries(
          RUNTIME_TEXT_FIELDS
            .filter((field) => typeof replacement[field] === 'string' && replacement[field].trim())
            .map((field) => [field, replacement[field]]),
        );
        const isT11Record = categoryKey === 'عادت‌های تکراری'
          && (day?.topic_id === 'T11'
            || /^عادت‌های تکراری-[0-9]{1,2}$/u.test(String(day?.id || ''))
            || /^T11-D[0-9]{1,2}$/i.test(String(day?.id || '')));
        const isT12Record = categoryKey === 'مرزبندی و نه گفتن'
          && (day?.topic_id === 'T12'
            || /^مرزبندی و نه گفتن-[0-9]{1,2}$/u.test(String(day?.id || ''))
            || /^T12-D[0-9]{1,2}$/i.test(String(day?.id || '')));
        const isT07Record = categoryKey === 'احساس گناه'
          && (day?.topic_id === 'T07'
            || /^احساس گناه-[0-9]{1,2}$/u.test(String(day?.id || ''))
            || /^T07-D[0-9]{1,2}$/i.test(String(day?.id || '')));
        const isT08Record = categoryKey === 'وابستگی عاطفی'
          && (day?.topic_id === 'T08'
            || /^وابستگی عاطفی-[0-9]{1,2}$/u.test(String(day?.id || ''))
            || /^T08-D[0-9]{1,2}$/i.test(String(day?.id || '')));
        const metadataFields = isT11Record ? T11_RUNTIME_METADATA_FIELDS
          : isT12Record ? T12_RUNTIME_METADATA_FIELDS
            : isT07Record ? T07_RUNTIME_METADATA_FIELDS
              : isT08Record ? T08_RUNTIME_METADATA_FIELDS : [];
        const runtimeMetadata = Object.fromEntries(metadataFields
          .filter((field) => Object.prototype.hasOwnProperty.call(replacement, field))
          .map((field) => [field, replacement[field]]));
        return { ...day, ...textOverrides, ...runtimeMetadata };
      }),
    };
  }

  return { ...content, categories };
}
