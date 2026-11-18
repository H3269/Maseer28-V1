import { normalizeDailyAssistantGuide } from './dailyAssistantGuideContract.js';
import T12_GUIDE from './t12DailyAssistantGuide.v1.json' with { type: 'json' };
import { addTeacherStyleFrame } from './teacherStylePreparedAnswer.js';
import { appendDailyAssistantSafetyReminder } from './dailyAssistantSafetyReminder.js';

export const T12_DAILY_ASSISTANT_GUIDES = Object.freeze(T12_GUIDE.records.map(normalizeDailyAssistantGuide));

const T12_SAFETY_REMINDER = [
  'یادآوری اختصاصی ایمنی و حریم خصوصی T12',
  'اگر تهدید، خشونت، کنترل اجباری، نظارت یا ترس از تلافی وجود دارد، گفت‌وگوی مستقیم یا اعلام مرز را انجام نده؛ اولویت با فاصله و حمایت امن است.',
  'اگر احتمال بررسی دستگاه، مرورگر یا حساب پیام‌رسان وجود دارد، جزئیات حساس یا برنامه خروج را در آن ذخیره یا ارسال نکن. در خطر فوری، از خدمات اضطراری محل زندگی کمک بگیر.',
].join('\n\n');

function toT12DayNumber(value) {
  const day = Number(value);
  return Number.isInteger(day) && day >= 1 && day <= 28 ? day : null;
}

function guideTitleForDay(day) {
  return T12_DAILY_ASSISTANT_GUIDES.find((item) => item.day === day)?.title || '';
}

function replaceExact(source, original, replacement) {
  if (!original || !replacement || original === replacement) return source;
  return source.split(original).join(replacement);
}

export function answerT12DailyPreparedQuestion({ day, message, dailyContent } = {}) {
  const dayNumber = toT12DayNumber(day);
  if (!dayNumber || !dailyContent || typeof dailyContent !== 'object') return null;
  const expectedId = `مرزبندی و نه گفتن-${String(dayNumber).padStart(2, '0')}`;
  const guide = T12_DAILY_ASSISTANT_GUIDES.find((item) => item.day === dayNumber);
  if (!guide || dailyContent.id !== expectedId || Number(dailyContent.day) !== dayNumber
    || String(dailyContent.title || '').trim() !== guideTitleForDay(dayNumber)
    || dailyContent.topic_id !== 'T12'
    || String(dailyContent.sourceExercise ?? dailyContent.exercise ?? '').trim() !== guide.exercise
    || String(dailyContent.sourceActionText ?? dailyContent.actionText ?? dailyContent.action ?? '').trim() !== guide.action) return null;
  const question = guide?.questions.find((item) => item.value === String(message || '').trim());
  if (!guide || !question || typeof question.answer !== 'string' || !question.answer.trim()) return null;

  let body = question.answer;
  body = replaceExact(body, guide.exercise, String(dailyContent.exercise || guide.exercise).trim());
  body = replaceExact(body, guide.action, String(dailyContent.actionText || dailyContent.action || guide.action).trim());
  body = replaceExact(body, guide.lightVersion, String(dailyContent.lightExerciseText || guide.lightVersion).trim());
  body = replaceExact(body, guide.progressVersion, String(dailyContent.progressActionText || guide.progressVersion).trim());
  body = replaceExact(body, guide.restVersion, String(dailyContent.restExerciseText || guide.restVersion).trim());
  body = replaceExact(body, guide.lightActionVersion, String(dailyContent.lightActionText || guide.lightActionVersion || '').trim());
  body = replaceExact(body, guide.progressActionVersion, String(dailyContent.progressActionText || guide.progressActionVersion || '').trim());
  body = replaceExact(body, guide.restActionVersion, String(dailyContent.restActionText || guide.restActionVersion || '').trim());
  if (question.kind === 'no_event') {
    body += `\n\n**نسخه استراحت امروز:** ${guide.restVersion}\n**اقدام اختصاصی امروز، فقط در صورت امنیت:** ${String(dailyContent.actionText || dailyContent.action || guide.action).trim()}`;
  }
  if (question.kind === 'can_change') {
    body += `\n\n**تمرین دقیق امروز:** ${String(dailyContent.exercise || guide.exercise).trim()}\n**اقدام اختصاصی امروز:** ${String(dailyContent.actionText || dailyContent.action || guide.action).trim()}`;
  }
  if (question.kind === 'duration') {
    body += `\n\n**تمرین دقیق امروز:** ${String(dailyContent.exercise || guide.exercise).trim()}\n**اقدام اختصاصی امروز:** ${String(dailyContent.actionText || dailyContent.action || guide.action).trim()}`;
  }

  const heading = `راهنمای روز ${guide.day} مرزبندی و نه گفتن — ${guide.title}`;
  const framedAnswer = addTeacherStyleFrame(`${heading}\n\n${body}`, {
    guide,
    question,
    topic: 'مرزبندی و نه گفتن',
  });
  const safetyKinds = new Set(['procrastination_increased', 'talk_other', 'success', 'stop']);
  const answerWithTopicSafety = safetyKinds.has(question.kind)
    ? framedAnswer.trimEnd() + '\n\n' + T12_SAFETY_REMINDER
    : framedAnswer;
  return appendDailyAssistantSafetyReminder(answerWithTopicSafety, question.kind);
}

export function getT12DailyAssistantPromptGroups(day) {
  const dayNumber = toT12DayNumber(day);
  const guide = T12_DAILY_ASSISTANT_GUIDES.find((item) => item.day === dayNumber);
  if (!guide) return [];
  return [
    { label: 'فهم تمرین روز ' + guide.day, questions: guide.questions.filter((item) => ['exercise_meaning', 'exercise_example'].includes(item.kind)) },
    { label: 'فهم اقدام اختصاصی روز ' + guide.day, questions: guide.questions.filter((item) => ['action_meaning', 'action_example'].includes(item.kind)) },
    { label: 'تفاوت تمرین و اقدام', questions: guide.questions.filter((item) => item.kind === 'exercise_action_difference') },
    { label: 'اجرا و موانع', questions: guide.questions.filter((item) => ['light_version', 'no_event', 'not_done', 'can_change', 'duration'].includes(item.kind)) },
    { label: 'ارزیابی و ایمنی', questions: guide.questions.filter((item) => ['success', 'stop', 'procrastination_increased', 'talk_other'].includes(item.kind)) },
  ];
}
