const INTERNAL_TOPIC_LABELS = Object.freeze({
  T01: 'خشم',
  T02: 'اضطراب',
  T03: 'ترس',
  T04: 'نفرت',
  T05: 'حسادت',
  T06: 'غم و سوگ',
  T07: 'احساس گناه',
  T08: 'وابستگی عاطفی',
  T09: 'اهمال‌کاری',
  T10: 'بی‌خوابی و مشکلات خواب',
  T11: 'عادت‌های تکراری',
  T12: 'مرزبندی و نه گفتن',
  T13: 'تنهایی',
  T14: 'کمبود انگیزه',
  T18: 'نفرت از خود',
});

export function cleanPreparedAssistantTopicText(value, topic) {
  let text = String(value || '')
    .replace(/«?بسته(?:‌ی| ی)?\s*T([12][0-9]|3[0-4]|0?[1-9])(?:-[A-Z]\d{2})?»?/g, (_, digits) => 'موضوع ' + (INTERNAL_TOPIC_LABELS['T' + digits.padStart(2, '0')] || 'مرتبط'))
    .replace(/\bT([12][0-9]|3[0-4]|0?[1-9])(?:-[A-Z]\d{2})?\b/g, (_, digits) => INTERNAL_TOPIC_LABELS['T' + digits.padStart(2, '0')] || 'موضوع مرتبط')
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
