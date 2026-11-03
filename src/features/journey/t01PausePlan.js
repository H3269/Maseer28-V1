const T01_PAUSE_PLAN = [
  'یک برنامه مکث امن با سه جزء بنویس:',
  '۱. نشانه مکث: یک علامت زودهنگام و قابل مشاهده در خودت را مشخص کن؛ مانند تندشدن گفتار، افزایش تنش بدن یا دشوارشدن گوش‌دادن.',
  '۲. محل فاصله‌گیری: فقط در یک اختلاف کم‌فشار و پس از اطمینان از مناسب‌بودن شرایط، فضای آرام، در دسترس و غیرمنزوی را انتخاب کن.',
  '۳. شرط بازگشت: زمان کوتاه و واقع‌بینانه‌ای برای بررسی دوباره گفتگو پیشنهاد کن؛ بازگشت فقط با تمایل آزادانه هر دو نفر و مناسب‌بودن شرایط انجام شود و الزامی نیست.',
  'اگر درباره مناسب‌بودن شرایط تردید داری، این برنامه را اجرا نکن و از یک فرد قابل اعتماد یا متخصص واجد صلاحیت کمک بگیر.',
].join(String.fromCharCode(10, 10));

export function getT01PausePlan(day) {
  if (!day || typeof day !== 'object') return '';

  // The production T01 category uses IDs such as خشم-10; topic_id is optional.
  const id = String(day.id || '');
  const runtimeIdMatch = /^خشم-([0-9]{1,2})$/u.exec(id);
  const canonicalIdMatch = /^T01-D([0-9]{1,2})$/i.exec(id);
  const isT01 = day.topic_id === 'T01' || Boolean(runtimeIdMatch || canonicalIdMatch);
  const dayNumber = day.day ?? runtimeIdMatch?.[1] ?? canonicalIdMatch?.[1];

  return isT01 && Number(dayNumber) === 10 ? T01_PAUSE_PLAN : '';
}
