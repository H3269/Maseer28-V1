const GATED_DAYS_BY_TOPIC = new Map([
  ['T01', new Set([10, 11, 17, 18, 19, 20, 21, 22, 23])],
  ['T05', new Set([6, 11, 15, 24])],
  ['T08', new Set([6, 11, 15, 24])],
  ['T12', new Set([6, 11, 15, 24])],
  ['T17', new Set([6, 11, 15, 24])],
  ['T25', new Set([6, 11, 15, 24])],
  ['T29', new Set([6, 11, 15, 24])],
]);

const RELATIONSHIP_COMMUNICATION_GATE = Object.freeze({
  gateId: 'relationship-communication-safety-v1',
  title: 'پیش از تمرین ارتباطی، ایمنی را بررسی کن',
  question: 'آیا در این رابطه یا تعامل می‌توانی بدون ترس از تهدید، خشونت، کنترل، فشار یا تلافی، گفت‌وگو را رد یا متوقف کنی؟',
  safeOption: 'بله؛ می‌توانم بدون ترس گفت‌وگو را رد یا متوقف کنم.',
  unsafeOption: 'نه، مطمئن نیستم، یا از واکنش طرف مقابل می‌ترسم.',
  disclaimer: 'این پرسش ارزیابی خطر نیست و نمی‌تواند ایمنی را تضمین کند. اگر تردید داری، گزینه دوم را انتخاب کن. لازم نیست جزئیات رابطه را در اپ ثبت کنی.',
  blockedTitle: 'تمرین ارتباطی امروز نمایش داده نمی‌شود',
  blockedMessage: 'فعلاً وارد گفت‌وگوی مستقیم، مواجهه یا مذاکره نشو. لازم نیست برای ادامه مسیر چیزی را به طرف مقابل ثابت کنی. در صورت نیاز با فرد مورد اعتماد، متخصص واجد صلاحیت یا خدمات حمایتی محل زندگی تماس بگیر. اگر خطر فوری وجود دارد، به محل امن برو و با خدمات اضطراری محل زندگی تماس بگیر.',
  safeReminder: 'این پاسخ فقط اجازه نمایش تمرین را می‌دهد و تضمین‌کننده ایمنی نیست. اگر شرایط تغییر کرد یا احساس ترس، فشار یا ناامنی کردی، تمرین را فوراً متوقف کن.',
});

const LEGACY_TOPIC_IDS_BY_PREFIX = new Map([
  ['خشم', 'T01'],
  ['حسادت', 'T05'],
  ['وابستگی عاطفی', 'T08'],
  ['مرزبندی و نه گفتن', 'T12'],
  ['مشکلات رابطه', 'T17'],
  ['رنجش و کینه', 'T25'],
  ['ترس از طرد شدن', 'T29'],
]);

export function getRelationshipSafetyGate(day) {
  if (!day || typeof day !== 'object') return null;
  const id = String(day.id || '');
  const legacyIdMatch = /^(خشم|مرزبندی و نه گفتن|مشکلات رابطه)-([0-9]{1,2})$/u.exec(id);
  const canonicalIdMatch = /^(T01|T05|T08|T12|T17|T25|T29)-D([0-9]{1,2})$/i.exec(id);
  const topicIds = [
    day.topic_id,
    legacyIdMatch ? LEGACY_TOPIC_IDS_BY_PREFIX.get(legacyIdMatch[1]) : null,
    canonicalIdMatch?.[1]?.toUpperCase(),
  ].filter(Boolean);
  const dayNumbers = [day.day, legacyIdMatch?.[2], canonicalIdMatch?.[2]]
    .filter((value) => value !== undefined && value !== null && value !== '')
    .map(Number);
  // Conflicting identifiers must not weaken a gate: if any trusted topic/day
  // identifier points to a gated interpersonal exercise, require the check.
  const requiresGate = topicIds.some((topicId) => {
    const gatedDays = GATED_DAYS_BY_TOPIC.get(String(topicId).toUpperCase());
    return gatedDays && dayNumbers.some((number) => Number.isInteger(number) && gatedDays.has(number));
  });
  return requiresGate ? RELATIONSHIP_COMMUNICATION_GATE : null;
}

export function isRelationshipSafetyConfirmed(day, response) {
  return !getRelationshipSafetyGate(day) || response === 'safe';
}

export function createRelationshipSafetySkipRecord(day, timestamp = new Date()) {
  if (!getRelationshipSafetyGate(day)) {
    throw new Error('Only a gated interpersonal communication exercise can use this safety skip.');
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
