import GUIDE from './t12DailyAssistantGuide.v1.json' with { type: 'json' };
import { addTeacherStyleFrame } from './teacherStylePreparedAnswer.js';
import { normalizeDailyAssistantGuide } from './dailyAssistantGuideContract.js';

const QUESTION_GROUPS = Object.freeze([
  { label: 'فهم تمرین', dayScoped: true, kinds: ['exercise_meaning', 'exercise_example'] },
  { label: 'فهم اقدام اختصاصی', dayScoped: true, kinds: ['action_meaning', 'action_example'] },
  { label: 'تفاوت تمرین و اقدام', dayScoped: false, kinds: ['exercise_action_difference'] },
  { label: 'اجرا و موانع', dayScoped: false, kinds: ['light_version', 'not_done', 'no_event', 'can_change', 'duration'] },
  { label: 'ارزیابی و ایمنی', dayScoped: false, kinds: ['boundary_safety', 'talk_other', 'success', 'stop'] },
]);

export const T12_DAILY_ASSISTANT_GUIDES = Object.freeze(GUIDE.records.map(normalizeDailyAssistantGuide));
const GUIDES = new Map(T12_DAILY_ASSISTANT_GUIDES.map((guide) => [guide.day, guide]));

function toDayNumber(value) {
  const day = Number(value);
  return Number.isInteger(day) && day >= 1 && day <= 28 ? day : null;
}

function normalizeVisibleText(value) {
  return String(value || '').normalize('NFKC')
    .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
    .replace(/\s+([،؛.!؟»])/gu, '$1')
    .replace(/\s+/gu, ' ')
    .trim().toLowerCase();
}

function replaceExact(source, original, replacement) {
  if (!original || !replacement || original === replacement) return source;
  return source.split(original).join(replacement);
}

function section(label, value) {
  const text = String(value || '').trim();
  return text ? `**${label}:** ${text}` : '';
}

function buildHeading(guide) {
  return `راهنمای روز ${guide.day} مرزبندی و نه گفتن — ${guide.title}`;
}

const BOUNDARY_SAFETY_NOTE = [
  '**یادآوری اختصاصی ایمنی و حریم خصوصی T12**',
  'این راهنما ارزیابی خطر، مشاوره حقوقی یا برنامه ایمنی تخصصی نیست. اگر از تهدید، خشونت، نظارت، کنترل اجباری یا تلافی می‌ترسی، گفت‌وگوی مستقیم یا اعلام مرز را انجام نده و برای بررسی گزینه‌های امن از حمایت تخصصی و راه ارتباطی امن استفاده کن.',
  'اگر احتمال دارد دستگاه، مرورگر یا حساب پیام‌رسانت بررسی شود، نام، جزئیات حساس یا برنامه خروج را در آن ذخیره یا ارسال نکن. در خطر فوری، خدمات اضطراری محل زندگی را در اولویت بگذار.',
].join('\n\n');

export function answerT12DailyPreparedQuestion({ day, message, dailyContent } = {}) {
  const dayNumber = toDayNumber(day);
  if (!dayNumber || !dailyContent || typeof dailyContent !== 'object') return null;

  const expectedId = `مرزبندی و نه گفتن-${String(dayNumber).padStart(2, '0')}`;
  if (dailyContent.id !== expectedId
    || Number(dailyContent.day) !== dayNumber
    || (dailyContent.topic_id != null && dailyContent.topic_id !== 'T12')) return null;

  const guide = GUIDES.get(dayNumber);
  if (!guide) return null;
  const question = guide.questions.find((item) => item.value === String(message || '').trim());
  if (!question || typeof question.answer !== 'string' || !question.answer.trim()) return null;

  const exercise = String(dailyContent.exercise || '').trim();
  const action = String(dailyContent.actionText || dailyContent.action || '').trim();
  const actionWithoutDisplayPrefix = action.replace(/^برای مسئله «مرزبندی و نه گفتن»،\s*/u, '');
  if (!exercise || !action
    || normalizeVisibleText(exercise) !== normalizeVisibleText(guide.exercise)
    || normalizeVisibleText(actionWithoutDisplayPrefix) !== normalizeVisibleText(guide.action)) return null;

  const lightExercise = String(dailyContent.lightExerciseText || guide.lightVersion || '').trim();
  const restAction = String(dailyContent.restActionText || guide.restActionVersion || guide.restVersion || '').trim();
  let body = replaceExact(question.answer, guide.exercise, exercise);
  body = replaceExact(body, guide.action, actionWithoutDisplayPrefix);
  body = replaceExact(body, guide.lightVersion, lightExercise);

  switch (question.kind) {
    case 'exercise_meaning':
      body += `\n\n${section('هدف امروز', guide.objective)}\n${section('مهارت امروز', guide.skill)}\n${section('منطق آموزشی', guide.mechanism)}\n${section('پرسش بازتاب', guide.reflectionQuestion)}`;
      break;
    case 'exercise_example':
      body += `\n\n${section('تمرین دقیق همین روز', exercise)}\n\nمثال فقط برای روشن‌شدن تمرین است؛ لازم نیست موقعیت دشوار بسازی یا با فردی ناامن روبه‌رو شوی.`;
      break;
    case 'action_meaning':
      body += `\n\n${section('اقدام اختیاری امروز', actionWithoutDisplayPrefix)}\n${section('معیار کافی‌بودن', guide.successCriterion)}`;
      break;
    case 'action_example':
      body += `\n\n${section('اقدام دقیق همین روز', actionWithoutDisplayPrefix)}\n\nاین اقدام فقط در صورت امنیت و اختیار قابل اجراست؛ انجام‌ندادن یا انتخاب راه غیرمستقیم نیز معتبر است.`;
      break;
    case 'light_version':
      body += `\n\n${section('نسخه سبک', lightExercise)}\n${section('نسخه استراحت', restAction)}\n\nنسخه پیشرفت اجباری نیست و هیچ تمرینی نیاز به جبران ندارد.`;
      break;
    case 'success':
      body += `\n\n${section('معیار موفقیت', guide.successCriterion)}\n${section('پرسش بازتاب', guide.reflectionQuestion)}\n\nموافقت یا واکنش طرف مقابل معیار موفقیت تو نیست.`;
      break;
    case 'stop':
      body += `\n\n${section('شرط توقف امروز', guide.stopCondition)}\n${section('محدودیت‌های کاربرد', (guide.contraindications || []).join(' '))}\n${section('حمایت انسانی مناسب', guide.whenToSeekHumanSupport)}`;
      break;
    case 'no_event':
      body += `\n\nاگر نمونه طبیعی یا آمادگی وجود ندارد، موقعیت تازه نساز و خودت را مجبور نکن. می‌توانی تمرین را رد کنی یا استراحت کنی: ${restAction}`;
      break;
    case 'exercise_action_difference':
      body += `\n\n${section('مهارت امروز', guide.skill)}\n${section('هدف آموزشی', guide.objective)}\n\nتمرین به‌تنهایی تعهدی برای گفت‌وگو، اعلام مرز یا اجرای اقدام ایجاد نمی‌کند.`;
      break;
    case 'not_done':
      body += '\n\nنیازی به جبران، فشار آوردن به خود یا شروع از روز اول نیست. اگر خواستی، از همین روز و با ظرفیت فعلی ادامه بده.';
      break;
    case 'boundary_safety':
      body = [body, section('شرط توقف', guide.stopCondition), BOUNDARY_SAFETY_NOTE].filter(Boolean).join('\n\n');
      break;
    case 'talk_other':
      body += `\n\nگفت‌وگو با فرد دیگر شرط انجام تمرین نیست. ${guide.whenToSeekHumanSupport}\n\n${BOUNDARY_SAFETY_NOTE}`;
      break;
    case 'can_change':
      body += `\n\n${section('هدف آموزشی', guide.objective)}\n${section('شرط توقف', guide.stopCondition)}\n\nتغییر روش نباید به اجبار، کنترل دیگری یا مواجهه ناامن تبدیل شود.`;
      break;
    case 'duration':
      body += '\n\nزمان استاندارد یا اعتبارسنجی‌شده‌ای برای این تمرین ثبت نشده است. فقط به اندازه‌ای که امن و راحت است وقت بگذار و هر زمان خواستی متوقف شو.';
      break;
    default:
      return null;
  }

  const safetyKinds = new Set(['boundary_safety', 'talk_other', 'stop']);
  if (safetyKinds.has(question.kind) && !body.includes(BOUNDARY_SAFETY_NOTE)) body += `\n\n${BOUNDARY_SAFETY_NOTE}`;
  return addTeacherStyleFrame(`${buildHeading(guide)}\n\n${body}`, { guide, question, topic: 'مرزبندی و نه گفتن' });
}

export function getT12DailyAssistantPromptGroups(day) {
  const dayNumber = toDayNumber(day);
  const guide = GUIDES.get(dayNumber);
  if (!guide) return [];
  return QUESTION_GROUPS.map((group) => ({
    label: group.dayScoped ? `${group.label} روز ${dayNumber}` : group.label,
    questions: guide.questions.filter((question) => group.kinds.includes(question.kind)),
  }));
}
