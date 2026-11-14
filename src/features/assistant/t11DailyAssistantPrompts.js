import GUIDE from './t11DailyAssistantGuide.v1.json' with { type: 'json' };

const QUESTION_GROUPS = Object.freeze([
  { label: 'فهم تمرین', ids: ['q01', 'q02'] },
  { label: 'فهم اقدام اختصاصی', ids: ['q03', 'q04'] },
  { label: 'تفاوت تمرین و اقدام', ids: ['q09'] },
  { label: 'اجرا و موانع', ids: ['q05', 'q08', 'q10', 'q13', 'q14'] },
  { label: 'ارزیابی و ایمنی', ids: ['q06', 'q07', 'q11', 'q12'] },
]);

const GUIDES = new Map(GUIDE.records.map((record) => [
  record.day,
  Object.freeze({
    ...record,
    questions: Object.freeze(record.questions.map((question) => Object.freeze({ ...question }))),
  }),
]));

function toDayNumber(value) {
  const day = Number(value);
  return Number.isInteger(day) && day >= 1 && day <= 28 ? day : null;
}

/**
 * T11 prepared answers are owner-review material. They are bound to the
 * canonical topic/day and exact visible exercise/action; no subtype is inferred,
 * no treatment protocol is added, and no shared-center reminder is appended.
 */
export function answerT11DailyPreparedQuestion({ day, message, dailyContent } = {}) {
  const dayNumber = toDayNumber(day);
  if (!dayNumber || !dailyContent || typeof dailyContent !== 'object') return null;

  const expectedId = `عادت‌های تکراری-${String(dayNumber).padStart(2, '0')}`;
  if (dailyContent.id !== expectedId
    || Number(dailyContent.day) !== dayNumber
    || (dailyContent.topic_id != null && dailyContent.topic_id !== 'T11')) return null;

  const guide = GUIDES.get(dayNumber);
  if (!guide || guide.reviewStatus !== 'pending_owner_review'
    || guide.subtopicId != null
    || !Array.isArray(guide.subtopicIds)
    || guide.subtopicIds.length !== 0) return null;

  const question = guide.questions.find((item) => item.value === String(message || '').trim());
  if (!question || typeof question.answer !== 'string' || !question.answer.trim()) return null;

  const exercise = String(dailyContent.exercise || '').trim();
  const action = String(dailyContent.actionText || dailyContent.action || '').trim();
  if (!exercise || !action || exercise !== guide.exercise || !action.endsWith(guide.action)) return null;

  return `راهنمای روز ${dayNumber} عادت‌های تکراری — ${guide.title}\n\n${question.answer}`;
}

export function getT11DailyAssistantPromptGroups(day) {
  const dayNumber = toDayNumber(day);
  const guide = GUIDES.get(dayNumber);
  if (!guide) return [];

  return QUESTION_GROUPS.map((group) => ({
    label: group.ids.length === 1 ? group.label : `${group.label} روز ${dayNumber}`,
    questions: guide.questions.filter((question) => group.ids.includes(question.id)),
  }));
}

export const T11_DAILY_ASSISTANT_GUIDES = Object.freeze(GUIDE.records);
