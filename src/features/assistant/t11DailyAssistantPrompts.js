import GUIDE from './t11DailyAssistantGuide.v1.json' with { type: 'json' };
import { addTeacherStyleFrame } from './teacherStylePreparedAnswer.js';
import { normalizeDailyAssistantGuide } from './dailyAssistantGuideContract.js';

const QUESTION_GROUPS = Object.freeze([
  { label: 'فهم تمرین', dayScoped: true, kinds: ['exercise_meaning', 'exercise_example'] },
  { label: 'فهم اقدام اختصاصی', dayScoped: true, kinds: ['action_meaning', 'action_example'] },
  { label: 'تفاوت تمرین و اقدام', dayScoped: false, kinds: ['exercise_action_difference'] },
  { label: 'اجرا و موانع', dayScoped: false, kinds: ['light_version', 'not_done', 'no_event', 'can_change', 'duration'] },
  { label: 'ارزیابی و ایمنی', dayScoped: false, kinds: ['t11_distress', 'talk_other', 'success', 'stop'] },
]);

export const T11_DAILY_ASSISTANT_GUIDES = Object.freeze(GUIDE.records.map(normalizeDailyAssistantGuide));
const GUIDES = new Map(T11_DAILY_ASSISTANT_GUIDES.map((guide) => [guide.day, guide]));

function toDayNumber(value) {
  const day = Number(value);
  return Number.isInteger(day) && day >= 1 && day <= 28 ? day : null;
}

function normalizeT11VisibleText(value) {
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

function buildT11Heading(guide) {
  return `راهنمای روز ${guide.day} عادت‌های تکراری — ${guide.title}`;
}

/**
 * T11 uses the shared T10 response architecture, but only T11 source content:
 * canonical topic/day identity, exact question matching, day heading,
 * structured question-kind handling and exact exercise/action substitution.
 */
export function answerT11DailyPreparedQuestion({ day, message, dailyContent } = {}) {
  const dayNumber = toDayNumber(day);
  if (!dayNumber || !dailyContent || typeof dailyContent !== 'object') return null;

  const expectedId = `عادت‌های تکراری-${String(dayNumber).padStart(2, '0')}`;
  if (dailyContent.id !== expectedId
    || Number(dailyContent.day) !== dayNumber
    || (dailyContent.topic_id != null && dailyContent.topic_id !== 'T11')) return null;

  const guide = GUIDES.get(dayNumber);
  if (!guide) return null;

  const question = guide.questions.find((item) => item.value === String(message || '').trim());
  if (!question || typeof question.answer !== 'string' || !question.answer.trim()) return null;

  const exercise = String(dailyContent.exercise || '').trim();
  const action = String(dailyContent.actionText || dailyContent.action || '').trim();
  const actionWithoutDisplayPrefix = action.replace(/^برای مسئله «عادت‌های تکراری»،\s*/u, '');
  if (!exercise || !action
    || normalizeT11VisibleText(exercise) !== normalizeT11VisibleText(guide.exercise)
    || normalizeT11VisibleText(actionWithoutDisplayPrefix) !== normalizeT11VisibleText(guide.action)) return null;

  const lightExercise = String(dailyContent.lightExerciseText || guide.lightVersion || '').trim();
  const lightAction = String(dailyContent.lightActionText || guide.lightActionVersion || guide.lightVersion || '').trim();
  const progressAction = String(dailyContent.progressActionText || guide.progressActionVersion || guide.progressVersion || '').trim();
  const restAction = String(dailyContent.restActionText || guide.restActionVersion || dailyContent.restExerciseText || guide.restVersion || '').trim();

  let body = replaceExact(question.answer, guide.exercise, exercise);
  body = replaceExact(body, guide.action, actionWithoutDisplayPrefix);
  body = replaceExact(body, guide.lightVersion, lightExercise);
  body = replaceExact(body, guide.lightActionVersion, lightAction);
  body = replaceExact(body, guide.progressVersion, progressAction);
  body = replaceExact(body, guide.progressActionVersion, progressAction);
  body = replaceExact(body, guide.restVersion, restAction);
  body = replaceExact(body, guide.restActionVersion, restAction);

  switch (question.kind) {
    case 'exercise_meaning':
      body += `\n\n${section('مهارت امروز', guide.skill)}\n${section('منطق آموزشی', guide.mechanism)}\n${section('معیار کافی‌بودن', guide.successCriterion)}\n${section('پرسش بازتاب', guide.reflectionQuestion)}`;
      break;
    case 'exercise_example':
      body += `\n\n${section('تمرین واقعی همین روز', exercise)}\n\nمثال فقط برای روشن‌شدن شیوه توصیف است؛ لازم نیست رفتاری را عمداً ایجاد، تکرار یا تحریک کنی.`;
      break;
    case 'action_meaning':
      body += `\n\n${section('اقدام اختصاصی امروز', actionWithoutDisplayPrefix)}\n${section('مهارت امروز', guide.skill)}\n${section('معیار کافی‌بودن', guide.successCriterion)}`;
      break;
    case 'action_example':
      body += `\n\n${section('متن اقدام اختصاصی همین روز', actionWithoutDisplayPrefix)}\n\nمثال، نسخه اجباری نیست و نباید به وارسی یا ثبت جزئیات حساس تبدیل شود.`;
      break;
    case 'light_version':
      body += `\n\n${section('نسخه سبک تمرین', lightExercise)}\n${lightAction !== lightExercise ? section('نسخه سبک اقدام', lightAction) : ''}\n${section('نسخه استراحت', restAction)}\n${section('نسخه پیشرفت، فقط در صورت آمادگی', progressAction)}\n\nاستراحت یا کنارگذاشتن تمرین نیز انتخاب معتبر است.`;
      break;
    case 'success':
      body += `\n\n${section('معیار کافی‌بودن', guide.successCriterion)}\n${section('پرسش بازتاب', guide.reflectionQuestion)}\n\nکاهش یا حذف رفتار، معیار موفقیت این بسته نیست.`;
      break;
    case 'stop':
      body += `\n\n${section('شرط توقف امروز', guide.stopCondition)}\n${section('محدودیت‌های کاربرد', (guide.contraindications || []).join(' '))}\n${section('زمان دریافت حمایت انسانی', guide.whenToSeekHumanSupport)}`;
      break;
    case 'no_event':
      body += `\n\nاگر نمونه‌ای به‌طور طبیعی در دسترس نیست، برای تکمیل برنامه موقعیت یا رفتار تازه نساز.\n${section('نسخه سبک یا جایگزین استراحت', restAction || lightExercise)}`;
      break;
    case 'exercise_action_difference':
      body += `\n\n${section('مهارت مورد توجه', guide.skill)}\n${section('هدف آموزشی روز', guide.objective)}\n\nتوصیف یا مرور، تعهدی برای تغییر، سرکوب یا حذف رفتار ایجاد نمی‌کند.`;
      break;
    case 'not_done':
      body += `\n\n${section('نسخه سبک در صورت تمایل', lightExercise)}\n${section('اگر امروز نیاز به استراحت داری', restAction)}\n\nروز ازدست‌رفته را جبران نکن و برای انجام تمرین به خودت فشار نیاور.`;
      break;
    case 't11_distress':
      body = [
        body,
        section('شرط توقف امروز', guide.stopCondition),
        section('محدودیت‌های کاربرد', (guide.contraindications || []).join(' ')),
        section('حمایت انسانی مناسب', guide.whenToSeekHumanSupport),
        'اگر خطر فوری یا آسیب جسمی جدی وجود دارد، کمک فوری محلی را در اولویت قرار بده.',
      ].filter(Boolean).join('\n\n');
      break;
    case 'talk_other':
      body += `\n\nگفت‌وگو یا افشای جزئیات رفتار شرط انجام هیچ تمرینی نیست.\n${section('در صورت نیاز به حمایت انسانی', guide.whenToSeekHumanSupport)}`;
      break;
    case 'can_change':
      body += `\n\n${section('هدف آموزشی که نباید از آن فراتر رفت', guide.objective)}\n${section('شرط توقف', guide.stopCondition)}\n\nتغییر روش نباید به پایش اجباری، خودتشخیصی یا تلاش برای سرکوب رفتار تبدیل شود.`;
      break;
    case 'duration':
      body += `\n\nزمان استاندارد ثبت‌شده: ${guide.durationMinutes == null ? 'وجود ندارد؛ مدت قطعی یا اعتبارسنجی‌شده‌ای ادعا نمی‌شود.' : `${guide.durationMinutes} دقیقه`}\n\n${section('تمرین ثبت‌شده', exercise)}\nهر زمان خواستی می‌توانی متوقف شوی.`;
      break;
    default:
      return null;
  }

  const answer = `${buildT11Heading(guide)}\n\n${body}`;
  return addTeacherStyleFrame(answer, { guide, question, topic: 'عادت‌های تکراری' });
}

export function getT11DailyAssistantPromptGroups(day) {
  const dayNumber = toDayNumber(day);
  const guide = GUIDES.get(dayNumber);
  if (!guide) return [];

  return QUESTION_GROUPS.map((group) => ({
    label: group.dayScoped ? `${group.label} روز ${dayNumber}` : group.label,
    questions: guide.questions.filter((question) => group.kinds.includes(question.kind)),
  }));
}

