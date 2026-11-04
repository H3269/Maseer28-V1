export function preserveDailyGuidanceSourceIdentity(source, guidance) {
  const rawDay = source?.day;
  const normalizedDay =
    typeof rawDay === 'number' ||
    (typeof rawDay === 'string' && rawDay.trim() !== '')
      ? Number(rawDay)
      : Number.NaN;

  return {
    ...guidance,
    id: source?.id ?? null,
    topic_id: source?.topic_id ?? null,
    day: Number.isInteger(normalizedDay) && normalizedDay >= 1 && normalizedDay <= 28
      ? normalizedDay
      : null,
  };
}
