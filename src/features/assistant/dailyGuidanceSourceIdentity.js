const RUNTIME_TEXT_FIELDS = Object.freeze([
  'title', 'intro', 'exercise', 'actionText', 'closing',
  'lightExerciseText', 'lightActionText', 'progressActionText',
  'restExerciseText', 'restActionText',
]);

export function preserveDailyGuidanceSourceIdentity(source, guidance) {
  const rawDay = source?.day;
  const normalizedDay =
    typeof rawDay === 'number' ||
    (typeof rawDay === 'string' && rawDay.trim() !== '')
      ? Number(rawDay)
      : Number.NaN;
  const sourceText = Object.fromEntries(
    RUNTIME_TEXT_FIELDS
      .filter((field) => typeof source?.[field] === 'string')
      .map((field) => [field, source[field]]),
  );

  return {
    ...sourceText,
    ...guidance,
    id: source?.id ?? null,
    topic_id: source?.topic_id ?? null,
    day: Number.isInteger(normalizedDay) && normalizedDay >= 1 && normalizedDay <= 28
      ? normalizedDay
      : null,
  };
}
