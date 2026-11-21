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
    .replace(/\bq\d{2}\b/gi, 'پرسش')
    .replace(/BFRB/gi, 'رفتارهای تکراری متمرکز بر بدن')
    .replace(/\bERP\b/gi, 'مواجهه و جلوگیری از پاسخ')
    .replace(/\bOCD\b/gi, 'اختلال وسواس فکری‌عملی')
    .replace(/\bHRT\b/gi, 'آموزش وارون‌سازی عادت')
    .replace(/\bComB\b/gi, 'مدل جامع رفتاری')
    .replace(/\bCBIT\b/gi, 'مداخله جامع رفتاری برای تیک')
    .replace(/\bmasking\b/gi, 'پنهان‌سازی رفتار')
.replace(/\bPGD\b/gi, 'اختلال سوگ طولانی‌مدت')
.replace(/\bPTSD\b/gi, 'اختلال استرس پس از سانحه')
    .replace(/\bOCD\b/gi, 'اختلال وسواس فکری‌عملی')
    .replace(/\bERP\b/gi, 'مواجهه و جلوگیری از پاسخ')
    .replace(/\bHRT\b/gi, 'آموزش وارونه‌سازی عادت')
    .replace(/\bComB\b/gi, 'مدل جامع رفتاری')
    .replace(/\bCBIT\b/gi, 'مداخله رفتاری جامع برای تیک')
    .replace(/\bmasking\b/gi, 'پنهان‌سازی حرکت یا صدا')
    .replace(/\btic\b/gi, 'تیک')
    .replace(/\bS01\b/gi, 'عادت ساده و بی‌ضرر')
    .replace(/\bS02\b/gi, 'رفتار همراه اجبار یا رفتار تکراری متمرکز بر بدن')
    .replace(/\bS03\b/gi, 'تیک یا استیمینگ')
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
