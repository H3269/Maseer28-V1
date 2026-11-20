const INTERNAL_TOPIC_LABELS = Object.freeze({ T01: 'خشم', T02: 'اضطراب', T03: 'ترس', T04: 'نفرت', T13: 'تنهایی', T18: 'نفرت از خود' });

export function cleanPreparedAssistantTopicText(value, topic) {
  let text = String(value || '')
    .replace(/«?بسته(?:‌ی| ی)?\s*T(0?[1-9]|[12][0-9]|3[0-4])(?:-[A-Z]\d{2})?»?/g, (_, digits) => 'موضوع ' + (INTERNAL_TOPIC_LABELS['T' + digits.padStart(2, '0')] || 'مرتبط'))
    .replace(/\bT(0?[1-9]|[12][0-9]|3[0-4])(?:-[A-Z]\d{2})?\b/g, (_, digits) => INTERNAL_TOPIC_LABELS['T' + digits.padStart(2, '0')] || 'موضوع مرتبط')
    .replace(/این بسته/g, 'این موضوع')
    .replace(/در این بسته/g, 'در این موضوع')
    .replace(/بسته فعلی/g, 'موضوع فعلی');
  if (topic) text = text.replace(/نام موضوع/g, topic);
  return text;
}

// پاسخ آماده باید لحن آموزشی و مثال اختصاصی خودش را داشته باشد.
// این تابع فقط اصطلاحات داخلی را پاک‌سازی می‌کند و متن قالبی مشترک به پاسخ‌ها نمی‌افزاید.
export function addTeacherStyleFrame(answer, { topic } = {}) {
  if (!answer || !topic) return null;
  return cleanPreparedAssistantTopicText(answer, topic);
}
