const T01_PAUSE_PLAN = [
  'یک برنامه مکث امن با سه جزء بنویس:',
  '۱. نشانه مکث: یک علامت زودهنگام و قابل مشاهده در خودت را مشخص کن؛ مانند تندشدن گفتار، افزایش تنش بدن یا دشوارشدن گوش‌دادن.',
  '۲. محل فاصله‌گیری: فقط در یک اختلاف کم‌فشار و پس از اطمینان از مناسب‌بودن شرایط، فضای آرام، در دسترس و غیرمنزوی را انتخاب کن.',
  '۳. شرط بازگشت: زمان کوتاه و واقع‌بینانه‌ای برای بررسی دوباره گفتگو پیشنهاد کن؛ بازگشت فقط با تمایل آزادانه هر دو نفر و مناسب‌بودن شرایط انجام شود و الزامی نیست.',
  'اگر درباره مناسب‌بودن شرایط تردید داری، این برنامه را اجرا نکن و از یک فرد قابل اعتماد یا متخصص واجد صلاحیت کمک بگیر.',
].join(String.fromCharCode(10, 10));

export function getT01PausePlan(day) {
  if (!day || typeof day !== 'object') return '';

  // Runtime daily-content records may expose only an ID such as T01-D10.
  const idMatch = /^([A-Z]\\d{2})-D(\\d{1,2})$/i.exec(String(day.id || ''));
  const topicId = day.topic_id || idMatch?.[1];
  const dayNumber = day.day ?? idMatch?.[2];

  return topicId === 'T01' && Number(dayNumber) === 10 ? T01_PAUSE_PLAN : '';
}
