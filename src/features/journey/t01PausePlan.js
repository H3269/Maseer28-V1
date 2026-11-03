const T01_PAUSE_PLAN = [
  'یک برنامه مکث امن با سه جزء بنویس:',
  '۱. نشانه مکث: یک علامت زودهنگام و قابل مشاهده در خودت را مشخص کن؛ مانند تندشدن گفتار، افزایش تنش بدن یا دشوارشدن گوش‌دادن.',
  '۲. محل فاصله‌گیری: فقط اگر هر دو نفر بدون ترس و فشار موافق‌اند و خروج آزادانه ممکن است، جایی را انتخاب کن که احساس امنیت و دسترسی به کمک داشته باشی.',
  '۳. شرط ادامه گفتگو: ادامه فقط با رضایت آزادانه هر دو نفر و مناسب‌بودن شرایط است؛ تعیین زمان بازگشت یا وعده ادامه گفتگو الزامی نیست.',
  'اگر درباره امنیت یا رضایت آزادانه تردید داری، برنامه مکث مشترک را اجرا نکن و از فرد یا خدمت حمایتی امن کمک بگیر.'
].join(String.fromCharCode(10, 10));

export function getT01PausePlan(day, topicName = '') {
  if (!day || typeof day !== 'object') return '';

  const id = String(day.id || '');
  const angerIdMatch = /^خشم-([0-9]{1,2})$/u.exec(id);
  const canonicalIdMatch = /^([A-Z][0-9]{2})-D([0-9]{1,2})$/i.exec(id);
  const categoryIdMatch = /^([^-\\s]+)-([0-9]{1,2})$/u.exec(id);

  // Conflicting topic/category identifiers must never attach a safety plan
  // to the wrong content, even when another field happens to say day 10.
  if (day.topic_id && day.topic_id !== 'T01') return '';
  if (topicName && topicName !== 'خشم') return '';
  if (canonicalIdMatch && canonicalIdMatch[1].toUpperCase() !== 'T01') return '';
  if (categoryIdMatch && categoryIdMatch[1] !== 'خشم' && !canonicalIdMatch) return '';

  const dayNumbers = [day.day, angerIdMatch?.[1], canonicalIdMatch?.[2], categoryIdMatch?.[2]]
    .filter((value) => value !== undefined && value !== null && value !== '')
    .map(Number);
  if (!dayNumbers.length || dayNumbers.some((number) => !Number.isInteger(number) || number !== 10)) return '';

  const isT01 = day.topic_id === 'T01' || topicName === 'خشم' || Boolean(angerIdMatch || canonicalIdMatch);
  return isT01 ? T01_PAUSE_PLAN : '';
}
