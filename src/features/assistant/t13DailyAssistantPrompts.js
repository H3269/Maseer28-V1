import { normalizeDailyAssistantGuide } from './dailyAssistantGuideContract.js';
import T13_GUIDE from './t13DailyAssistantGuide.v1.json' with { type: 'json' };
import { addTeacherStyleFrame } from './teacherStylePreparedAnswer.js';
import { appendDailyAssistantSafetyReminder } from './dailyAssistantSafetyReminder.js';

export const T13_DAILY_ASSISTANT_GUIDES = Object.freeze(T13_GUIDE.records.map(normalizeDailyAssistantGuide));

function toT13DayNumber(value) {
  const day = Number(value);
  return Number.isInteger(day) && day >= 1 && day <= 28 ? day : null;
}

function replaceExact(source, original, replacement) {
  if (!original || !replacement || original === replacement) return source;
  return source.split(original).join(replacement);
}

export function answerT13DailyPreparedQuestion({ day, message, dailyContent } = {}) {
  const dayNumber = toT13DayNumber(day);
  if (!dayNumber || !dailyContent || typeof dailyContent !== 'object') return null;
  const guide = T13_DAILY_ASSISTANT_GUIDES.find((item) => item.day === dayNumber);
  const expectedId = `تنهایی-${String(dayNumber).padStart(2, '0')}`;
  if (!guide || dailyContent.id !== expectedId || Number(dailyContent.day) !== dayNumber
    || String(dailyContent.title || '').trim() !== guide.title
    || (dailyContent.topic_id != null && dailyContent.topic_id !== 'T13')
    || String(dailyContent.sourceExercise ?? dailyContent.exercise ?? '').trim() !== guide.exercise
    || String(dailyContent.sourceActionText ?? dailyContent.actionText ?? dailyContent.action ?? '').trim() !== guide.action) return null;
  const question = guide.questions.find((item) => item.value === String(message || '').trim());
  if (!question || typeof question.answer !== 'string' || !question.answer.trim()) return null;

  let body = question.answer;
  body = replaceExact(body, guide.exercise, String(dailyContent.exercise || guide.exercise).trim());
  body = replaceExact(body, guide.action, String(dailyContent.actionText || dailyContent.action || guide.action).trim());

  const heading = `راهنمای روز ${guide.day} تنهایی — ${guide.title}`;
  const framedAnswer = addTeacherStyleFrame(`${heading}\n\n${body}`, { guide, question, topic: 'تنهایی' })
    .replaceAll('یادآوری اختصاصی ایمنی موضوع مرتبط', 'یادآوری اختصاصی ایمنی T13');
  const safetyKinds = new Set(['loneliness_increased', 'talk_other', 'success', 'stop']);
  return appendDailyAssistantSafetyReminder(framedAnswer, question.kind);
}

export function getT13DailyAssistantPromptGroups(day) {
  const dayNumber = toT13DayNumber(day);
  const guide = T13_DAILY_ASSISTANT_GUIDES.find((item) => item.day === dayNumber);
  if (!guide) return [];
  return [
    { label: 'فهم تمرین روز ' + guide.day, questions: guide.questions.filter((item) => ['exercise_meaning', 'exercise_example'].includes(item.kind)) },
    { label: 'فهم اقدام اختصاصی روز ' + guide.day, questions: guide.questions.filter((item) => ['action_meaning', 'action_example'].includes(item.kind)) },
    { label: 'تفاوت تمرین و اقدام', questions: guide.questions.filter((item) => item.kind === 'exercise_action_difference') },
    { label: 'اجرا و موانع', questions: guide.questions.filter((item) => ['light_version', 'no_event', 'not_done', 'can_change', 'duration'].includes(item.kind)) },
    { label: 'ارزیابی و ایمنی', questions: guide.questions.filter((item) => ['success', 'stop', 'loneliness_increased', 'talk_other'].includes(item.kind)) },
  ];
}
