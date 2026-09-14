const BUTTON_EMOJIS = [
  ['شروع مسیر', '🚀'],
  ['متوجه شدم', '✅'],
  ['ادامه به ارزیابی', '➡️'],
  ['ثبت و شروع', '💾'],
  ['ادامه مسیر', '▶️'],
  ['کتابخانه', '📚'],
  ['عضویت درکانال', '📣'],
  ['پشتیبانی', '🎧'],
  ['ثبت امروز', '💾'],
  ['ثبت ارزیابی', '💾'],
  ['روز قبل', '◀️'],
  ['داشبورد', '🏠'],
  ['مطالعه جلد', '📖'],
  ['بازگشت', '↩️'],
  ['شروع مسیر تازه', '🔄'],
  ['مشاهده گزارش', '📊'],
  ['آرشیو', '🗂️'],
];

/** Mirrors the original V72 applyButtonEmojis() behavior. */
export function buttonLabel(text) {
  const value = String(text ?? '').trim();
  if (!value || /^[^\p{L}\p{N}]/u.test(value)) return value;
  const hit = BUTTON_EMOJIS.find(([needle]) => value.includes(needle));
  return hit ? `${hit[1]} ${value}` : value;
}
