const T01_PAUSE_PLAN = [
  'یک برنامه مکث امن با سه جزء بنویس:',
  '۱. نشانه مکث: یک علامت زودهنگام و قابل مشاهده در خودت را مشخص کن؛ مانند تندشدن گفتار، افزایش تنش بدن یا دشوارشدن گوش‌دادن.',
  '۲. محل فاصله‌گیری: فقط اگر هر دو نفر بدون ترس و فشار موافق‌اند و خروج آزادانه ممکن است، جایی را انتخاب کن که احساس امنیت و دسترسی به کمک داشته باشی.',
  '۳. شرط ادامه گفتگو: ادامه فقط با رضایت آزادانه هر دو نفر و مناسب‌بودن شرایط است؛ تعیین زمان بازگشت یا وعده ادامه گفتگو الزامی نیست.',
  'اگر درباره امنیت یا رضایت آزادانه تردید داری، برنامه مکث مشترک را اجرا نکن و از فرد یا خدمت حمایتی امن کمک بگیر.'
].join(String.fromCharCode(10, 10));

export function getT01PausePlan(day, topicName = '') {
  if (!day || typeof day !== 'object') return '';

  // The production T01 category uses IDs such as خشم-10; topic_id is optional.
  const id = String(day.id || '');
  const runtimeIdMatch = /^خشم-([0-9]{1,2})$/u.exec(id);
  const canonicalIdMatch = /^T01-D([0-9]{1,2})$/i.exec(id);
  const isT01 = day.topic_id === 'T01' || topicName === 'خشم' || Boolean(runtimeIdMatch || canonicalIdMatch);
  const dayNumber = day.day ?? runtimeIdMatch?.[1] ?? canonicalIdMatch?.[1];

  return isT01 && Number(dayNumber) === 10 ? T01_PAUSE_PLAN : '';
}
