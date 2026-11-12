export function getCanonicalDailyRecordId(categoryKey, dayNumber) {
  if (typeof categoryKey !== 'string' || !categoryKey.trim()) return null;
  if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 28) return null;
  const canonicalCategoryKey = categoryKey.trim() === 'سوگ و فقدان' ? 'غم و سوگ' : categoryKey.trim();
  return `${canonicalCategoryKey}-${String(dayNumber).padStart(2, '0')}`;
}

export function selectDailyContentCategory(categories, problem) {
  if (!categories || typeof categories !== 'object' || Array.isArray(categories)) return null;
  if (typeof problem !== 'string' || !problem.trim()) return null;
  const canonicalProblem = problem.trim() === 'سوگ و فقدان' ? 'غم و سوگ' : problem.trim();
  if (!Object.prototype.hasOwnProperty.call(categories, canonicalProblem)) return null;

  const category = categories[canonicalProblem];
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


export function isCompleteDailyContentCategory(categories, problem) {
  const category = selectDailyContentCategory(categories, problem);
  if (!category) return false;
  const ids = new Set();
  for (let day = 1; day <= 28; day += 1) {
    const record = selectCanonicalDailyRecord(category, day);
    if (!record || record.id !== getCanonicalDailyRecordId(problem, day) || ids.has(record.id)) return false;
    ids.add(record.id);
  }
  return category.days.length === 28;
}
