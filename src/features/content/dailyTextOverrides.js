const RUNTIME_TEXT_FIELDS = Object.freeze([
  'title', 'intro', 'exercise', 'actionText', 'closing',
  'lightExerciseText', 'lightActionText', 'progressActionText',
  'restExerciseText', 'restActionText',
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
        return { ...day, ...textOverrides };
      }),
    };
  }

  return { ...content, categories };
}
