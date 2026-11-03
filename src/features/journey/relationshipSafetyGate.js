const GATED_T01_DAYS = new Set([10, 11, 17, 20, 21, 22, 23]);

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

export function createRelationshipSafetySkipRecord(day, timestamp = new Date()) {
  if (!getRelationshipSafetyGate(day)) {
    throw new Error('Only a gated T01 communication exercise can use this safety skip.');
  }
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (!Number.isFinite(date.getTime())) throw new Error('A valid skip timestamp is required.');
  return {
    status: 'skipped_safety_gate',
    feedbackText: 'این تمرین به دلیل ملاحظه ایمنی اجرا نشد. هیچ امتیازی ثبت نشده و این ثبت به معنی بهبود یا بدترشدن نیست.',
    exerciseId: typeof day.id === 'string' ? day.id.slice(0, 200) : '',
    updatedAt: date.toISOString(),
  };
}
