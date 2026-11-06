import topicRegistry from '../../../public/assistant/knowledge/topics.v1.json' with { type: 'json' };
import subtopicRegistry from '../../../public/assistant/knowledge/subtopics.v1.json' with { type: 'json' };

const PAGE_CONTEXTS = Object.freeze({
  home: {
    label: 'معرفی و شروع',
    purpose: 'صفحه آغاز برنامه است؛ معرفی مسیر را می‌خوانی و با دکمه شروع وارد مراحل ساخت پروفایل، تنظیم مسیر و ارزیابی اولیه می‌شوی.',
    actions: ['آشنایی با برنامه', 'شروع مسیر', 'رفتن به مراحل ثبت پروفایل و تنظیم مسیر'],
    returnHint: 'برای ادامه از دکمه شروع همین صفحه استفاده کن.',
  },
  howWorks: {
    label: 'نحوه کار برنامه',
    purpose: 'در این بخش روند استفاده از مسیر ۲۸ روزه و ترتیب مراحل آن توضیح داده می‌شود.',
    actions: ['خواندن مراحل برنامه', 'آشنایی با ترتیب شروع و ادامه مسیر', 'بازگشت به صفحه آغاز'],
    returnHint: 'برای بازگشت از کنترل بازگشت همین صفحه استفاده کن.',
  },
  about: {
    label: 'درباره برنامه',
    purpose: 'این بخش درباره هدف و چارچوب برنامه مسیر۲۸ و محدودیت‌های آن توضیح می‌دهد.',
    actions: ['خواندن معرفی برنامه', 'آشنایی با چارچوب برنامه', 'بازگشت به صفحه آغاز'],
    returnHint: 'برای بازگشت از کنترل بازگشت همین صفحه استفاده کن.',
  },
  assessment: {
    label: 'ارزیابی اولیه',
    purpose: 'پرسش‌های خودگزارشی آغاز مسیر را ثبت می‌کنی تا یک خط مبنای شخصی برای مقایسه در پایان برنامه داشته باشی؛ این ارزیابی تشخیص پزشکی یا روان‌شناختی نیست.',
    actions: ['پاسخ‌دادن به پرسش‌های ارزیابی اولیه', 'ثبت پاسخ‌ها', 'رفتن به مسیر پس از تکمیل ارزیابی'],
    returnHint: 'پرسش‌ها را در همین صفحه تکمیل کن و از دکمه ثبت یا ادامه موجود استفاده کن.',
  },
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

export function answerPageAssistantQuestion({ screen, message, libraryContext } = {}) {
  const context = getPageAssistantContext(screen);
  const text = normalize(message);
  if (!text || context.screen === 'unknown') return null;

  // Cross-page questions about the product itself are answerable from the
  // app's stable, non-personal feature map regardless of the current screen.
  if (/^(?:این برنامه چیست|مسیر ?28 چیست|برنامه مسیر ?28 چیست|این اپلیکیشن چیست)$/u.test(text)) {
    return 'مسیر۲۸ یک برنامه مرحله‌ای ۲۸ روزه است که کاربر در آن موضوع مسیر را انتخاب می‌کند، تمرین‌های روزانه را انجام می‌دهد و پاسخ‌ها و بازخوردهای خودگزارشی را مرور می‌کند. این برنامه جایگزین تشخیص یا درمان تخصصی نیست.';
  }
  if (/^(?:چه بخش هایی دارد|چه بخش هایی توی برنامه هست|امکانات برنامه چیست|داخل برنامه چه چیزهایی هست|چه قسمت هایی دارد)$/u.test(text)) {
    return 'بخش‌های اصلی برنامه شامل معرفی و نحوه کار، پروفایل، تنظیم موضوع و هدف مسیر، ارزیابی اولیه، خانه و ادامه مسیر، تمرین روزانه، نتیجه تمرین، ارزیابی پایانی، گزارش مسیر، آرشیو، کتابخانه و پشتیبانی است. بخش‌هایی که در دسترس تو هستند به وضعیت و مرحله فعلی مسیر بستگی دارند.';
  }
  if (/^(?:برنامه چند روزه است|مسیر چند روز طول می کشد|چند روز باید ادامه بدهم)$/u.test(text)) {
    return 'ساختار اصلی برنامه ۲۸ روزه است. برای راهنمایی دقیق درباره روز جاری، وارد بخش تمرین روزانه شو.';
  }
  if (/^(?:از کجا شروع کنم|چطور شروع کنم|شروع برنامه از کجاست)$/u.test(text)) {
    return screen === 'home'
      ? 'از دکمه «شروع» در همین صفحه استفاده کن؛ سپس مراحل پروفایل، تنظیم موضوع و هدف مسیر و ارزیابی اولیه را به‌ترتیب تکمیل کن.'
      : 'برای شروع مسیر تازه یا نخستین ورود، به صفحه آغاز برنامه برگرد و دکمه «شروع» را بزن. برنامه سپس مراحل پروفایل، تنظیم مسیر و ارزیابی اولیه را نمایش می‌دهد.';
  }

  const topicRows = Array.isArray(topicRegistry.topics) ? topicRegistry.topics : [];
  const subtopicRows = Array.isArray(subtopicRegistry.subtopics) ? subtopicRegistry.subtopics : [];
  const registryIsDraft = topicRegistry.registry_status !== 'active'
    || subtopicRegistry.registry_status !== 'active'
    || topicRows.some((topic) => topic.review_status !== 'approved');

  const asksSubtopics = /(?:زیر ?موضوع|زیرموضوع|زیر موضوع)/u.test(text)
    && /(?:چیست|چیستند|کدام|چه|فهرست|دار[یی]د|هست)/u.test(text);
  if (asksSubtopics) {
    const matchedTopic = topicRows.find((topic) => {
      const topicName = normalize(topic.name);
      return topicName.length > 2 && (text.includes(topicName) || text.includes(normalize(topic.topic_id)));
    });
    if (matchedTopic) {
      const names = subtopicRows
        .filter((item) => item.topic_id === matchedTopic.topic_id)
        .sort((a, b) => String(a.subtopic_id).localeCompare(String(b.subtopic_id), 'en'))
        .map((item) => item.name);
      if (names.length) {
        const reviewNote = registryIsDraft
          ? '\\n\\nوضعیت اعتبار: این فهرست پیش‌نویس است و زیرموضوع‌ها هنوز بازبینی تخصصی و تأیید نهایی نشده‌اند؛ نام‌ها را نباید تعریف یا تشخیص قطعی تلقی کرد.'
          : '';
        return `زیرموضوع‌های ثبت‌شده برای «${matchedTopic.name}»:\\n${names.map((name, index) => (index + 1) + ') ' + name).join('\\n')}${reviewNote}`;
      }
    }
  }

  const asksTopicList = /(?:چه موضوع(?:ات|هایی)|فهرست موضوع(?:ات|ها)|موضوع(?:ات|های) مسیر|۳۴ موضوع|34 موضوع|موضوعات قابل انتخاب)/u.test(text);
  if (asksTopicList && topicRows.length) {
    const names = [...topicRows]
      .sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0))
      .map((topic) => topic.name);
    const reviewNote = registryIsDraft
      ? '\\n\\nنکته مهم: این‌ها نام‌های ثبت‌شده در فهرست پیش‌نویس اپ هستند. رجیستری هنوز در وضعیت نیازمند بازبینی تخصصی است؛ بنابراین این فهرست به‌معنای تأیید علمی تعریف‌ها یا مناسب‌بودن هر موضوع برای همه افراد نیست.'
      : '';
    return `فهرست موضوعات ثبت‌شده مسیر۲۸ (${names.length} مورد):\\n${names.map((name, index) => (index + 1) + ') ' + name).join('\\n')}${reviewNote}`;
  }

  if (screen === 'books' && /(?:چه کتاب(?: هایی|‌هایی)|فهرست کتاب|لیست کتاب|کتاب(?: های|‌های) موجود|چه کتابی داریم)/u.test(text)) {
    const titles = Array.isArray(libraryContext?.titles)
      ? libraryContext.titles.map((title) => String(title || '').trim()).filter(Boolean)
      : [];
    return titles.length
      ? 'کتاب‌های موجود در کتابخانه:\\n' + titles.map((title, index) => (index + 1) + ') ' + title).join('\\n')
      : 'عنوان کتاب‌های کتابخانه هنوز بارگذاری نشده است؛ پس از آماده‌شدن فهرست دوباره بپرس.';
  }

  // Accept only standalone page-navigation questions. Extra clauses must
  // fall through to the safety-first router instead of being masked by UI help.
  const asksActions = /^(?:(?:اینجا|در این صفحه|در این بخش)\s+)?(?:چه کارهایی|چه کاری|چه گزینه هایی|چه امکاناتی)\s*(?:می توانم انجام بدهم|می توانم انجام دهم|می تونم انجام بدم|وجود دارد|دارم)?$/u.test(text);
  if (asksActions) {
    return `در صفحه «${context.label}» می‌توانی: ${context.actions.join('، ')}.`;
  }

  const asksPurpose = /^(?:این صفحه|این بخش|اینجا)\s*(?:برای چیست|چیه|چه کاربردی دارد|چه کاربردی داره|چه کاری می کند|چه کاری انجام می دهد)$/u.test(text);
  if (asksPurpose) return context.purpose;

  const asksReturn = /^(?:(?:چطور|چگونه)\s*(?:به خانه\s*)?(?:برگردم|بازگردم|بازگشت کنم)|راه بازگشت به خانه|(?:می خواهم|می خوام)\s*(?:به خانه بروم|برگردم))$/u.test(text);
  if (asksReturn) return context.returnHint;

  return null;
}

export const PAGE_ASSISTANT_CONTEXT_SCREENS = Object.freeze(Object.keys(PAGE_CONTEXTS));
