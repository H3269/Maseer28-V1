const GATED_T01_DAYS = new Set([11, 17, 20, 21, 22]);

const RELATIONSHIP_COMMUNICATION_GATE = Object.freeze({
  gateId: 'relationship-communication-safety-v1',
  title: 'پیش از تمرین ارتباطی، ایمنی را بررسی کن',
  question: 'آیا در این رابطه می‌توانی بدون ترس از تهدید، خشونت، کنترل، فشار یا تلافی، گفت‌وگو را رد یا متوقف کنی؟',
  safeOption: 'بله؛ می‌توانم بدون ترس گفت‌وگو را رد یا متوقف کنم.',
  unsafeOption: 'نه، مطمئن نیستم، یا از واکنش طرف مقابل می‌ترسم.',
  disclaimer: 'این پرسش ارزیابی خطر نیست و نمی‌تواند ایمنی را تضمین کند. اگر تردید داری، گزینه دوم را انتخاب کن. لازم نیست جزئیات رابطه را در اپ ثبت کنی.',
  blockedTitle: 'تمرین ارتباطی امروز نمایش داده نمی‌شود',
  blockedMessage: 'فعلاً وارد گفت‌وگوی مستقیم، مواجهه یا مذاکره نشو. لازم نیست برای ادامه مسیر چیزی را به طرف مقابل ثابت کنی. در صورت نیاز با فرد مورد اعتماد، متخصص واجد صلاحیت یا خدمات حمایتی محل زندگی تماس بگیر. اگر خطر فوری وجود دارد، به محل امن برو و با خدمات اضطراری محل زندگی تماس بگیر.',
  safeReminder: 'این پاسخ فقط اجازه نمایش تمرین را می‌دهد و تضمین‌کننده ایمنی نیست. اگر شرایط تغییر کرد یا احساس ترس، فشار یا ناامنی کردی، تمرین را فوراً متوقف کن.',
});

export function getRelationshipSafetyGate(day) {
  if (!day || typeof day !== 'object') return null;
  const isAngerTopic = day.topic_id === 'T01' || /^خشم-\d{2}$/.test(String(day.id || ''));
  const dayNumber = Number(day.day);
  if (!isAngerTopic || !GATED_T01_DAYS.has(dayNumber)) return null;
  return RELATIONSHIP_COMMUNICATION_GATE;
}

export function isRelationshipSafetyConfirmed(day, response) {
  return !getRelationshipSafetyGate(day) || response === 'safe';
}
