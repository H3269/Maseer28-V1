import { getDailySafetyMode } from '../content/dailySafety.js';

const COMMON_INTERPERSONAL_DAYS = [6, 11, 15, 24];
const GATED_DAYS_BY_TOPIC = new Map([
  ['T01', new Set([10, 11, 17, 18, 19, 20, 21, 22, 23])],
  ...Array.from({ length: 32 }, (_, index) => {
    const topicId = 'T' + String(index + 3).padStart(2, '0');
    const topicDays = topicId === 'T05'
      ? [...COMMON_INTERPERSONAL_DAYS, 10, 16, 26]
      : COMMON_INTERPERSONAL_DAYS;
    return [topicId, new Set(topicDays)];
  }),
]);

const RELATIONSHIP_COMMUNICATION_GATE = Object.freeze({
  gateId: 'relationship-communication-safety-v1',
  title: 'پیش از تمرین ارتباطی، ایمنی را بررسی کن',
  question: 'آیا در این رابطه یا تعامل، هر دو نفر می‌توانند آزادانه گفت‌وگو را رد یا متوقف کنند، بدون ترس از تهدید، خشونت، کنترل، فشار یا تلافی؟',
  safeOption: 'بله؛ هر دو نفر می‌توانند آزادانه گفت‌وگو را رد یا متوقف کنند.',
  unsafeOption: 'نه، مطمئن نیستم، یا هرکدام از ما برای ادامه گفت‌وگو یا پاسخ‌دادن تحت فشار است.',
  disclaimer: 'این پرسش ارزیابی خطر نیست و نمی‌تواند ایمنی یا نبود کنترل اجباری را تضمین کند. اگر درباره امنیت یا آزادی انتخاب هر یک از دو نفر تردید داری، گزینه دوم را انتخاب کن. پاسخ همین پرسش در پروفایل یا آرشیو ذخیره نمی‌شود؛ اما پاسخ‌های روزانه، آرشیو و بخشی از پروفایل در حافظه محلی مرورگر همین دستگاه نگهداری می‌شوند و خود اپ آن‌ها را جداگانه رمزگذاری نمی‌کند. اگر فرد دیگری به دستگاه یا مرورگر دسترسی دارد یا آن را بررسی می‌کند، جزئیات حساس وارد نکن و در صورت امکان از دستگاه یا راه ارتباطی امن‌تری استفاده کن.',
  blockedTitle: 'تمرین ارتباطی امروز نمایش داده نمی‌شود',
  blockedMessage: 'فعلاً وارد گفت‌وگوی مستقیم، مواجهه یا مذاکره نشو. هیچ‌یک از دو نفر را برای ادامه گفت‌وگو، پاسخ‌دادن یا تغییر رفتار تحت فشار قرار نده. در صورت نیاز با فرد مورد اعتماد، متخصص واجد صلاحیت یا خدمات حمایتی محل زندگی تماس بگیر. اگر خطر فوری وجود دارد، به محل امن برو و با خدمات اضطراری محل زندگی تماس بگیر.',
  safeReminder: 'این پاسخ فقط اجازه نمایش تمرین را می‌دهد و تضمین‌کننده ایمنی نیست. اگر هرکدام از دو نفر نمی‌خواهد ادامه دهد، یا شرایط تغییر کرد و ترس، فشار یا ناامنی پدید آمد، گفت‌وگو را متوقف کن و تمرین را کنار بگذار.',
});

const LEGACY_TOPIC_IDS_BY_PREFIX = new Map([
  ['خشم', 'T01'],
  ['اضطراب', 'T02'],
  ['ترس', 'T03'],
  ['نفرت', 'T04'],
  ['حسادت', 'T05'],
  ['غم و سوگ', 'T06'],
  ['احساس گناه', 'T07'],
  ['وابستگی عاطفی', 'T08'],
  ['اهمال‌کاری', 'T09'],
  ['بی‌خوابی و مشکلات خواب', 'T10'],
  ['عادت‌های تکراری', 'T11'],
  ['مرزبندی و نه گفتن', 'T12'],
  ['تنهایی', 'T13'],
  ['کمبود انگیزه', 'T14'],
  ['اعتمادبه‌نفس پایین', 'T15'],
  ['افکار منفی و نشخوار فکری', 'T16'],
  ['مشکلات رابطه', 'T17'],
  ['نفرت از خود', 'T18'],
  ['خودسرزنشی', 'T19'],
  ['کمال‌گرایی', 'T20'],
  ['اجتناب', 'T21'],
  ['استرس', 'T22'],
  ['احساس بی‌ارزشی', 'T23'],
  ['مشکل در کنترل هیجان', 'T24'],
  ['رنجش و کینه', 'T25'],
  ['شرم', 'T26'],
  ['ترس از قضاوت', 'T27'],
  ['ترس از شکست', 'T28'],
  ['ترس از طرد شدن', 'T29'],
  ['شک و تردید', 'T30'],
  ['کنترل‌گری', 'T31'],
  ['بی‌انگیزگی', 'T32'],
  ['خودانتقادی', 'T33'],
  ['مشکل دیگر', 'T34'],
]);

function parseLegacyTopicDay(id) {
  const separator = id.lastIndexOf('-');
  if (separator <= 0) return null;
  const prefix = id.slice(0, separator);
  const dayNumber = id.slice(separator + 1);
  const topicId = LEGACY_TOPIC_IDS_BY_PREFIX.get(prefix);
  if (!topicId || !/^[0-9]{1,2}$/u.test(dayNumber)) return null;
  return { topicId, dayNumber };
}

function getTopicDayIdentity(day) {
  if (!day || typeof day !== 'object') return { topicIds: [], dayNumbers: [] };
  const id = String(day.id || '');
  const legacyId = parseLegacyTopicDay(id);
  const canonicalIdMatch = /^(T[0-9]{2})-D([0-9]{1,2})$/i.exec(id);
  const topicIds = [
    day.topic_id,
    legacyId?.topicId,
    canonicalIdMatch?.[1],
  ].filter(Boolean).map((topicId) => String(topicId).toUpperCase());
  const dayNumbers = [day.day, legacyId?.dayNumber, canonicalIdMatch?.[2]]
    .filter((value) => value !== undefined && value !== null && value !== '')
    .map(Number)
    .filter(Number.isInteger);
  return { topicIds, dayNumbers };
}

export function getCanonicalTopicIdForCategory(categoryKey) {
  const key = typeof categoryKey === 'string' ? categoryKey.trim() : '';
  return LEGACY_TOPIC_IDS_BY_PREFIX.get(key) || null;
}

const SUPPORT_SEEKING_PRIVACY_NOTICE = 'پاسخ‌های روزانه، آرشیو و بخشی از پروفایل در حافظه محلی مرورگر همین دستگاه نگهداری می‌شوند و اپ آن‌ها را جداگانه رمزگذاری نمی‌کند. پیش از نوشتن نام یا جزئیات یا آماده‌کردن/ارسال پیام، بررسی کن فرد ناامن به دستگاه، مرورگر، اعلان‌ها یا حساب پیام‌رسان دسترسی ندارد. اگر احتمال نظارت، تلافی یا افشای اطلاعات هست، نام و جزئیات حساس را وارد نکن و پیام یا تماس را انجام نده؛ حمایت‌خواهی اختیاری است و می‌توانی از دستگاه یا مسیر امن و مستقل کمک بگیری.';

export function getInterpersonalPrivacyNotice(day) {
  const { topicIds, dayNumbers } = getTopicDayIdentity(day);
  const hasSharedLegacyTopic = topicIds.some((topicId) => {
    const match = /^T([0-9]{2})$/u.exec(topicId);
    const topicNumber = Number(match?.[1]);
    return Number.isInteger(topicNumber) && topicNumber >= 3 && topicNumber <= 34;
  });
  const hasSharedSupportSeekingDay = dayNumbers.some((number) => number === 12 || number === 18);
  const hasAnxietySupportMessage = topicIds.includes('T02') && dayNumbers.includes(24);
  return (hasSharedLegacyTopic && hasSharedSupportSeekingDay) || hasAnxietySupportMessage
    ? SUPPORT_SEEKING_PRIVACY_NOTICE
    : null;
}

export function getRelationshipSafetyGate(day) {
  const { topicIds, dayNumbers } = getTopicDayIdentity(day);
  // Conflicting identifiers must not weaken a gate: if any trusted topic/day
  // identifier points to a gated interpersonal exercise, require the check.
  const requiresGate = topicIds.some((topicId) => {
    const gatedDays = GATED_DAYS_BY_TOPIC.get(topicId);
    return gatedDays && dayNumbers.some((number) => gatedDays.has(number));
  });
  return requiresGate ? RELATIONSHIP_COMMUNICATION_GATE : null;
}

export function isRelationshipSafetyConfirmed(day, response) {
  return !getRelationshipSafetyGate(day) || response === 'safe';
}

export function createRelationshipSafetySkipRecord(day, timestamp = new Date()) {
  if (!getRelationshipSafetyGate(day) || getDailySafetyMode(day) === 'blocked') {
    throw new Error('Only an approved or legacy routine gated interpersonal exercise can use this safety skip.');
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