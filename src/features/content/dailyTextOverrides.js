const RUNTIME_TEXT_FIELDS = Object.freeze([
  'title', 'intro', 'exercise', 'actionText', 'closing',
  'lightExerciseText', 'lightActionText', 'progressActionText',
  'restExerciseText', 'restActionText',
]);

const T11_REVIEW_METADATA_FIELDS = Object.freeze([
  'objective', 'skill', 'mechanism', 'lightVersion', 'progressVersion', 'restVersion',
  'successCriterion', 'reflectionQuestion', 'stopCondition', 'stopConditions',
  'contraindications', 'whenToSeekHumanSupport', 'durationMinutes', 'durationStatus',
  'exerciseType', 'riskLevel', 'sourceIds', 'evidenceGrade', 'reviewStatus',
  'subtopicId', 'subtopicIds', 'subtopicMappingStatus', 'duration_minutes',
  'duration_status', 'exercise_type', 'risk_level', 'source_ids', 'evidence_grade',
  'review_status', 'subtopic_ids', 'subtopic_mapping_status', 'stop_conditions',
  'when_to_seek_human_support', 'review_record_id',
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
        const reviewMetadata = isT11Record
          ? Object.fromEntries(T11_REVIEW_METADATA_FIELDS
            .filter((field) => Object.prototype.hasOwnProperty.call(replacement, field))
            .map((field) => [field, replacement[field]]))
          : {};
        return { ...day, ...textOverrides, ...reviewMetadata };
      }),
    };
  }

  return { ...content, categories };
}
