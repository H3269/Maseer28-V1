export function selectDailyContentCategory(categories, problem) {
  if (!categories || typeof categories !== 'object' || Array.isArray(categories)) return null;
  if (typeof problem !== 'string' || !problem.trim()) return null;
  if (!Object.prototype.hasOwnProperty.call(categories, problem)) return null;

  const category = categories[problem];
  return category && typeof category === 'object' && Array.isArray(category.days)
    ? category
    : null;
}

export function selectCanonicalDailyRecord(category, requestedDay) {
  if (!category || !Array.isArray(category.days)) return null;
  if (typeof requestedDay !== 'number' && typeof requestedDay !== 'string') return null;
  if (typeof requestedDay === 'string' && !requestedDay.trim()) return null;

  const dayNumber = Number(requestedDay);
  if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 28) return null;

  const matches = category.days.filter((record) => Number(record?.day) === dayNumber);
  if (matches.length !== 1) return null;

  const record = matches[0];
  if (!record || typeof record !== 'object' || typeof record.id !== 'string' || !record.id.trim()) return null;
  return record;
}
