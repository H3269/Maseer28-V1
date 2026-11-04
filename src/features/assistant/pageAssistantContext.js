const PAGE_CONTEXTS = Object.freeze({
  dashboard: {
    label: 'خانه',
    purpose: 'نمای کلی مسیر ۲۸ روزه است؛ از اینجا می‌توانی مسیر امروز را ادامه بدهی یا به بخش‌های اصلی برنامه بروی.',
    actions: ['ادامه مسیر امروز', 'ویرایش پروفایل', 'بازکردن کتابخانه', 'مرور آرشیو', 'رفتن به پشتیبانی'],
    returnHint: 'برای رفتن به خانه از دکمه «خانه» در نوار پایین استفاده کن.',
  },
  profile: {
    label: 'پروفایل',
    purpose: 'برای بازبینی یا ویرایش اطلاعات پروفایل و ذخیره تغییرات استفاده می‌شود.',
    actions: ['بازبینی اطلاعات پروفایل', 'ویرایش اطلاعات', 'ذخیره تغییرات', 'انصراف و بازگشت'],
    returnHint: 'برای بازگشت به خانه، دکمه «خانه» در نوار پایین را بزن؛ برای لغو ویرایش نیز دکمه بازگشت همین صفحه را استفاده کن.',
  },
  pathSetup: {
    label: 'تنظیم مسیر',
    purpose: 'در این بخش موضوع اصلی مسیر، مدت درگیری و هدفی را که برای این دوره انتخاب می‌کنی ثبت می‌کنی.',
    actions: ['انتخاب موضوع مسیر', 'ثبت مدت درگیری', 'نوشتن هدف', 'ذخیره تنظیمات مسیر'],
    returnHint: 'اگر می‌خواهی از این بخش خارج شوی، از کنترل بازگشت خود صفحه استفاده کن؛ تغییرات ذخیره‌نشده را بدون بررسی رها نکن.',
  },
  day: {
    label: 'تمرین روزانه',
    purpose: 'محتوای روز جاری و راهنمای متنی همان روز در این صفحه قرار دارد.',
    actions: ['خواندن تمرین روز', 'ثبت پاسخ روزانه', 'پرسیدن درباره متن تمرین و راهکار اختصاصی همان روز'],
    returnHint: 'برای رفتن به خانه، دکمه «خانه» در نوار پایین را بزن.',
  },
  dailyResult: {
    label: 'نتیجه تمرین',
    purpose: 'بازخورد و نتیجه ثبت‌شده برای روزی را که به پایان رسانده‌ای نشان می‌دهد. امتیازها خودگزارشی‌اند و به‌تنهایی تشخیص یا اثربخشی درمان را تعیین نمی‌کنند.',
    actions: ['مرور بازخورد روز', 'خواندن قدم بعدی', 'رفتن به روز بعد یا ارزیابی پایانی', 'بازگشت به خانه'],
    returnHint: 'برای بازگشت به خانه، دکمه «خانه» در نوار پایین یا دکمه بازگشت به داشبورد را بزن.',
  },
  books: {
    label: 'کتابخانه',
    purpose: 'برای مرور کتاب‌های موجود و بازکردن کتاب جهت مطالعه استفاده می‌شود.',
    actions: ['مرور کتاب‌ها', 'انتخاب و بازکردن کتاب', 'ادامه مطالعه از کتاب انتخاب‌شده'],
    returnHint: 'برای خروج از کتابخانه، دکمه «خانه» یا یکی از بخش‌های نوار پایین را انتخاب کن.',
  },
  support: {
    label: 'پشتیبانی',
    purpose: 'اطلاعات و راه‌های ارتباط با مرکز را در اختیارت می‌گذارد.',
    actions: ['مرور راه‌های ارتباطی', 'استفاده از گزینه‌های تماس یا کپی اطلاعات تماس'],
    returnHint: 'برای بازگشت، دکمه «خانه» در نوار پایین یا کنترل بازگشت صفحه را بزن.',
  },
  final: {
    label: 'ارزیابی پایانی',
    purpose: 'برای ثبت ارزیابی خودگزارشی پایان مسیر ۲۸ روزه استفاده می‌شود.',
    actions: ['پاسخ‌دادن به پرسش‌های پایانی', 'ثبت ارزیابی', 'مشاهده نتیجه مسیر پس از ثبت'],
    returnHint: 'برای بازگشت به خانه، دکمه «خانه» در نوار پایین را بزن.',
  },
  done: {
    label: 'پایان مسیر',
    purpose: 'پس از تکمیل مسیر، دسترسی به گزارش و بخش‌های تکمیلی برنامه را فراهم می‌کند.',
    actions: ['مشاهده گزارش', 'رفتن به کتابخانه', 'رفتن به پشتیبانی', 'مرور آرشیو', 'شروع مسیر تازه'],
    returnHint: 'برای بازگشت به خانه، دکمه «خانه» در نوار پایین را بزن.',
  },
  report: {
    label: 'گزارش مسیر',
    purpose: 'خلاصه مسیر و پاسخ‌ها و امتیازهای خودگزارشی را نمایش می‌دهد؛ این گزارش ابزار تشخیص یا نتیجه قطعی درمان نیست.',
    actions: ['مرور جمع‌بندی مسیر', 'مرور تغییرات خودگزارشی', 'مشاهده پاسخ‌های ثبت‌شده', 'رفتن به کتابخانه یا پشتیبانی', 'بازگشت به خانه'],
    returnHint: 'برای بازگشت به خانه، دکمه «خانه» یا دکمه بازگشت به داشبورد را بزن.',
  },
  archive: {
    label: 'آرشیو',
    purpose: 'برای مرور مسیرهای قبلی و مدیریت نسخه‌های ذخیره‌شده استفاده می‌شود.',
    actions: ['مرور مسیرهای قبلی', 'خروجی‌گرفتن از آرشیو', 'حذف انتخابی یک مسیر', 'بازگشت به خانه'],
    returnHint: 'برای بازگشت به خانه، دکمه «خانه» یا کنترل بازگشت صفحه را بزن.',
  },
});

const UNKNOWN_CONTEXT = Object.freeze({
  screen: 'unknown',
  label: 'صفحه جاری',
  purpose: 'برای این صفحه هنوز راهنمای ثابت تعریف نشده است.',
  actions: Object.freeze([]),
  returnHint: 'از کنترل‌های خود برنامه برای بازگشت استفاده کن.',
});

function normalize(value) {
  return String(value ?? '').normalize('NFKC')
    .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[\u200c\u200f\u200e]/g, ' ')
    .replace(/[،؛.!؟?]/g, ' ')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}

export function getPageAssistantContext(screen) {
  const known = Object.prototype.hasOwnProperty.call(PAGE_CONTEXTS, screen);
  const source = known ? PAGE_CONTEXTS[screen] : UNKNOWN_CONTEXT;
  return Object.freeze({
    screen: known ? screen : 'unknown',
    label: source.label,
    purpose: source.purpose,
    actions: Object.freeze([...source.actions]),
    returnHint: source.returnHint,
  });
}

export function answerPageAssistantQuestion({ screen, message } = {}) {
  const context = getPageAssistantContext(screen);
  const text = normalize(message);
  if (!text || context.screen === 'unknown') return null;

  // Accept only standalone page-navigation questions. Extra clauses must
  // fall through to the safety-first router instead of being masked by UI help.
  const asksActions = /^(?:(?:اینجا|در این صفحه|در این بخش)\\s+)?(?:چه کارهایی|چه کاری|چه گزینه هایی|چه امکاناتی)\\s*(?:می توانم انجام بدهم|می توانم انجام دهم|می تونم انجام بدم|وجود دارد|دارم)?$/u.test(text);
  if (asksActions) {
    return `در صفحه «${context.label}» می‌توانی: ${context.actions.join('، ')}.`;
  }

  const asksPurpose = /^(?:این صفحه|این بخش|اینجا)\\s*(?:برای چیست|چیه|چه کاربردی دارد|چه کاربردی داره|چه کاری می کند|چه کاری انجام می دهد)$/u.test(text);
  if (asksPurpose) return context.purpose;

  const asksReturn = /^(?:(?:چطور|چگونه)\\s*(?:به خانه\\s*)?(?:برگردم|بازگردم|بازگشت کنم)|راه بازگشت به خانه|(?:می خواهم|می خوام)\\s*(?:به خانه بروم|برگردم))$/u.test(text);
  if (asksReturn) return context.returnHint;

  return null;
}

export const PAGE_ASSISTANT_CONTEXT_SCREENS = Object.freeze(Object.keys(PAGE_CONTEXTS));
