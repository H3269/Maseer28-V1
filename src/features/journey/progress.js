const SKIPPED_STATUSES = new Set(['skipped_human_review', 'skipped_safety_gate']);

export function getJourneyProgressCounts(journey) {
  const days = Array.isArray(journey?.completed)
    ? [...new Set(journey.completed.map(Number).filter((day) => Number.isInteger(day) && day >= 1 && day <= 28))]
    : [];
  const skippedDays = days.filter((day) => SKIPPED_STATUSES.has(journey?.daily?.[day]?.status));
  return {
    recordedDays: days.length,
    skippedDays: skippedDays.length,
    completedExercises: days.length - skippedDays.length,
  };
}
