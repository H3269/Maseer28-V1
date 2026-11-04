export function preserveDailyGuidanceSourceIdentity(source, guidance) {
  return {
    ...guidance,
    id: source?.id ?? null,
    topic_id: source?.topic_id ?? null,
    day: Number.isInteger(Number(source?.day)) ? Number(source.day) : null,
  };
}
