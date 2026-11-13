import { normalizeDailyAssistantGuide } from './dailyAssistantGuideContract.js';
import T09_GUIDE from './t09DailyAssistantGuide.v1.json' with { type: 'json' };
import { addTeacherStyleFrame } from './teacherStylePreparedAnswer.js';

export const T09_DAILY_ASSISTANT_GUIDES = Object.freeze(T09_GUIDE.records.map(normalizeDailyAssistantGuide));

function toT09DayNumber(value) {
  const day = Number(value);
  return Number.isInteger(day) && day >= 1 && day <= 28 ? day : null;
}

function replaceExact(source, original, replacement) {
  if (!original || !replacement || original === replacement) return source;
  return source.split(original).join(replacement);
}

function buildT09Heading(guide) {
  return `راهنمای روز ${guide.day} اهمال‌کاری — ${guide.title}`;
}

export function answerT09DailyPreparedQuestion({ day, message, dailyContent } = {}) {
  const dayNumber = toT09DayNumber(day);
  if (!dayNumber || !dailyContent || typeof dailyContent !== 'object') return null;
  const expectedId = `اهمال‌کاری-${String(dayNumber).padStart(2, '0')}`;
  if (dailyContent.id !== expectedId || Number(dailyContent.day) !== dayNumber
    || (dailyContent.topic_id != null && dailyContent.topic_id !== 'T09')) return null;

  const guide = T09_DAILY_ASSISTANT_GUIDES.find((item) => item.day === dayNumber);
  const question = guide?.questions.find((item) => item.value === String(message || '').trim());
  if (!guide || !question || typeof question.answer !== 'string' || !question.answer.trim()) return null;

  const exercise = String(dailyContent.exercise || guide.exercise).trim();
  const action = String(dailyContent.actionText || dailyContent.action || guide.action).trim();
  const lightExercise = String(dailyContent.lightExerciseText || guide.lightVersion).trim();
  const lightAction = String(dailyContent.lightActionText || guide.lightActionVersion || guide.lightVersion).trim();
  const progressAction = String(dailyContent.progressActionText || guide.progressVersion).trim();
  const restAction = String(dailyContent.restActionText || dailyContent.restExerciseText || guide.restVersion).trim();

  let body = question.answer;
  body = replaceExact(body, guide.exercise, exercise);
  body = replaceExact(body, guide.action, action);
  body = replaceExact(body, guide.lightVersion, lightExercise);
  body = replaceExact(body, guide.progressVersion, progressAction);
  body = replaceExact(body, guide.restVersion, restAction);

  switch (question.kind) {
    case 'exercise_meaning':
      body += `\n\n**منطق آموزشی امروز:** ${guide.mechanism}\n\n**معیار پایان:** ${guide.successCriterion}\n**برای بازبینی:** ${guide.reflectionPrompt || 'آیا کار به‌اندازه کافی مشخص شده است؟'}`;
      break;
    case 'exercise_example':
      body += `\n\n**تمرین واقعی همین روز:** ${exercise}\n\nمثال فقط برای روشن‌شدن روش است؛ لازم نیست تجربه‌ات شبیه آن باشد یا موقعیتی تازه بسازی.`;
      break;
    case 'action_meaning':
      body += `\n\n**چرا این اقدام انتخاب شده؟** ${guide.mechanism}\n**معیار کافی‌بودن:** ${guide.successCriterion}`;
      break;
    case 'action_example':
      body += `\n\n**اقدام واقعی همین روز:** ${action}\n\nمثال نسخه اجباری نیست؛ آن را با اختیار، منابع و شرایط واقعی خودت تطبیق بده.`;
      break;
    case 'light_version':
      body += `\n\n**نسخه سبک اقدام:** ${lightAction}\n**اگر به استراحت نیاز داری:** ${restAction}\n**نسخه پیشرفت، فقط در صورت آمادگی:** ${progressAction}\n\nبرای جبران، کار اضافه نکن؛ توقف یا استراحت نیز انتخاب معتبر است.`;
      break;
    case 'success':
      body += `\n\n**پرسش بازبینی:** ${guide.reflectionPrompt || 'چه چیزی درباره مانع امروز روشن‌تر شد؟'}\n\nموفقیت به معنی شروع یا تکمیل اجباری کار نیست؛ معیار همان مهارت مشخص‌شده برای امروز است.`;
      break;
    case 'stop':
      body += `\n\n**نسخه استراحت:** ${restAction}\n**محدودیت کاربرد:** ${(guide.contraindications || []).join(' ')}\n**زمان دریافت حمایت انسانی:** ${guide.whenToSeekHumanSupport}`;
      break;
    case 'no_event':
      body += `\n\nاگر نمونه واقعی وجود ندارد، برای تکمیل برنامه مسئله مصنوعی نساز. می‌توانی نبود نمونه را ثبت کنی یا امروز استراحت کنی.\n**نسخه سبک:** ${lightExercise}`;
      break;
    case 'exercise_action_difference':
      body += `\n\n**مهارت مشترک:** ${guide.skill}\n**معیار پایان:** ${guide.successCriterion}\n\nانجام تمرین، تو را به اجرای اقدام یا تکمیل کار اصلی متعهد نمی‌کند.`;
      break;
    case 'not_done':
      body += `\n\n**بازگشت کوچک:** ${lightExercise}\n**اگر امروز نیاز به استراحت داری:** ${restAction}\n\nلازم نیست روزهای ازدست‌رفته را جبران کنی؛ از همین روز و با ظرفیت فعلی ادامه بده.`;
      break;
    case 'procrastination_increased':
      body = [
        '**اگر فشار یا مقاومت هنگام شروع/ادامه بیشتر شد**',
        '۱. مکث کن؛ افزایش مقاومت به‌تنهایی نشانه تنبلی، بی‌ارادگی یا شکست نیست.',
        '۲. مانع را از میان ابهام کار، بزرگی گام، ظرفیت جسمی/ذهنی، نگرانی از نتیجه و محدودیت بیرونی مشخص کن؛ علت را حدس قطعی نزن.',
        `۳. اگر امن و متناسب است، فقط بخش کوچک و غیرحساس تمرین را نگه دار: ${exercise}`,
        `۴. اگر ادامه مناسب نیست، نسخه استراحت را انتخاب کن: ${restAction}`,
        `**شرط توقف اصلی امروز:** ${guide.stopCondition}\n**شرط‌های توقف تکمیلی:** ${(guide.stopConditions || []).join(' ')}`,
        `**محدودیت کاربرد:** ${(guide.contraindications || []).join(' ')}`,
        `**زمان حمایت انسانی:** ${guide.whenToSeekHumanSupport}`
      ].join('\n\n');
      break;
    case 'talk_other':
      body = [
        '**آیا لازم است با فرد دیگری صحبت کنی؟**',
        'خیر؛ گفت‌وگو شرط انجام تمرین نیست. فقط اگر اجرای اقدام امروز به اطلاعات، اجازه، دسترسی، هماهنگی یا تقسیم مسئولیتی نیاز دارد که در اختیار تو نیست، یک درخواست روشن و محدود درباره همان مانع مطرح کن.',
        `**اقدام اختصاصی امروز:** ${action}`,
        'اگر گفت‌وگو امن یا ممکن نیست، یا اختیار رد و توقف آزادانه نداری، درخواست را مطرح نکن؛ نیاز به تصمیم یا دسترسی دیگران را به‌عنوان مانع بیرونی ثبت کن و فقط بخش امن و در اختیار خودت را انتخاب کن.',
        `**در صورت تداوم مانع:** ${guide.whenToSeekHumanSupport}`
      ].join('\n\n');
      break;
    case 'can_change':
      body += `\n\n**نسخه سبک:** ${lightExercise}\n**چه چیزی باید حفظ شود؟** هدف روز یعنی ${guide.objective}. اگر تغییر تمرین آن را به تکلیف سنگین‌تر یا ناامن تبدیل می‌کند، تغییر مناسب نیست؛ می‌توانی توقف کنی.`;
      break;
    case 'duration':
      body += `\n\nاین زمان فقط برآورد اولیه برای خود تمرین است، نه زمان انجام کار اصلی؛ استاندارد یا اعتبارسنجی‌شده نیست و می‌توانی زودتر تمام کنی یا استراحت کنی.\n**تمرین امروز:** ${exercise}`;
      break;
    default:
      return null;
  }

  const fullAnswer = `${buildT09Heading(guide)}\n\n${body}`;
  return addTeacherStyleFrame(fullAnswer, { guide, question, topic: 'اهمال‌کاری' });
}

export function getT09DailyAssistantPromptGroups(day) {
  const dayNumber = toT09DayNumber(day);
  const guide = T09_DAILY_ASSISTANT_GUIDES.find((item) => item.day === dayNumber);
  if (!guide) return [];
  return [
    { label: 'فهم تمرین روز ' + guide.day, questions: guide.questions.filter((item) => ['exercise_meaning', 'exercise_example'].includes(item.kind)) },
    { label: 'فهم اقدام اختصاصی روز ' + guide.day, questions: guide.questions.filter((item) => item.kind.startsWith('action_')) },
    { label: 'تفاوت تمرین و اقدام', questions: guide.questions.filter((item) => item.kind === 'exercise_action_difference') },
    { label: 'اجرا و موانع', questions: guide.questions.filter((item) => ['light_version', 'not_done', 'no_event', 'can_change', 'duration'].includes(item.kind)) },
    { label: 'ارزیابی و ایمنی', questions: guide.questions.filter((item) => ['procrastination_increased', 'talk_other', 'success', 'stop'].includes(item.kind)) },
  ];
}
