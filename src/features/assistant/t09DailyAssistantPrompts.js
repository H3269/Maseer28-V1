import T09_GUIDE from './t09DailyAssistantGuide.v1.json' with { type: 'json' };

export const T09_DAILY_ASSISTANT_GUIDES = Object.freeze(T09_GUIDE.records);

function toT09DayNumber(value) {
  const day = Number(value);
  return Number.isInteger(day) && day >= 1 && day <= 28 ? day : null;
}

export function answerT09DailyPreparedQuestion({ day, message, dailyContent } = {}) {
  const dayNumber = toT09DayNumber(day);
  if (!dayNumber || !dailyContent || typeof dailyContent !== 'object') return null;
  const expectedId = `اهمال‌کاری-${String(dayNumber).padStart(2, '0')}`;
  if (dailyContent.id !== expectedId || Number(dailyContent.day) !== dayNumber
    || (dailyContent.topic_id != null && dailyContent.topic_id !== 'T09')) return null;
  const guide = T09_DAILY_ASSISTANT_GUIDES.find((item) => item.day === dayNumber);
  const question = guide?.questions.find((item) => item.value === String(message || '').trim());
  return typeof question?.answer === 'string' && question.answer.trim() ? question.answer : null;
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
