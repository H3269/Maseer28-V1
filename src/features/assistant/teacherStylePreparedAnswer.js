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
  T15: 'اعتمادبه‌نفس پایین',
  T16: 'افکار منفی و نشخوار فکری',
  T17: 'مشکلات رابطه',
  T18: 'نفرت از خود',
  T19: 'خودسرزنشی',
  T20: 'کمال‌گرایی',
  T21: 'اجتناب',
  T22: 'استرس',
  T23: 'احساس بی‌ارزشی',
  T24: 'مشکل در کنترل هیجان',
  T25: 'رنجش و کینه',
  T26: 'شرم',
  T27: 'ترس از قضاوت',
  T28: 'ترس از شکست',
  T29: 'ترس از طرد شدن',
  T30: 'شک و تردید',
  T31: 'کنترل‌گری',
  T32: 'بی‌انگیزگی',
  T33: 'خودانتقادی',
  T34: 'مشکل دیگر',
});

const INTERNAL_TERM_REPLACEMENTS = Object.freeze([
  [/\bq\d{2}\b/gi, 'پرسش'],
  [/\bBFRB\b/gi, 'رفتارهای تکراری متمرکز بر بدن'],
  [/\bERP\b/gi, 'مواجهه و جلوگیری از پاسخ'],
  [/\bOCD\b/gi, 'اختلال وسواس فکری‌عملی'],
  [/\bHRT\b/gi, 'آموزش وارونه‌سازی عادت'],
  [/\bComB\b/gi, 'مدل جامع رفتاری'],
  [/\bCBIT\b/gi, 'مداخله جامع رفتاری برای تیک'],
  [/\bmasking\b/gi, 'پنهان‌سازی حرکت یا صدا'],
  [/\bPGD\b/gi, 'اختلال سوگ طولانی‌مدت'],
  [/\bPTSD\b/gi, 'اختلال استرس پس از سانحه'],
  [/\btic\b/gi, 'تیک'],
  [/\bstimming\b/gi, 'خودتحریکی تکراری'],
  [/\bS01\b/gi, 'عادت ساده و بی‌ضرر'],
  [/\bS02\b/gi, 'رفتار همراه اجبار یا رفتار تکراری متمرکز بر بدن'],
  [/\bS03\b/gi, 'تیک یا خودتحریکی تکراری'],
]);

export function cleanPreparedAssistantTopicText(value, topic) {
  let text = String(value || '')
    .replace(/«?بسته(?:‌ی| ی)?\s*T([12][0-9]|3[0-4]|0?[1-9])(?:-[A-Z]\d{2})?»?/g, (_, digits) => 'موضوع ' + (INTERNAL_TOPIC_LABELS['T' + digits.padStart(2, '0')] || 'مرتبط'))
    .replace(/\bT([12][0-9]|3[0-4]|0?[1-9])(?:-[A-Z]\d{2})?\b/g, (_, digits) => INTERNAL_TOPIC_LABELS['T' + digits.padStart(2, '0')] || 'موضوع مرتبط');

  for (const [pattern, replacement] of INTERNAL_TERM_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }

  text = text
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
