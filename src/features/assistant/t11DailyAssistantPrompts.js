import ANSWERS from './t11DailyAssistantAnswers.v1.json' with { type: 'json' };

const QUESTION_KINDS = Object.freeze({
  q01: 'exercise_meaning',
  q02: 'exercise_example',
  q03: 'action_meaning',
  q04: 'action_example',
  q05: 'light_version',
  q06: 'success',
  q07: 'stop',
  q08: 'no_event',
  q09: 'exercise_action_difference',
  q10: 'not_done',
  q11: 't11_distress',
  q12: 'talk_other',
  q13: 'can_change',
  q14: 'duration',
});

const GUIDES = new Map(ANSWERS.records.map((record) => [
  record.day,
  Object.freeze({
    ...record,
    questions: Object.freeze(record.questions.map((question) => Object.freeze({
      ...question,
      value: question.label,
      kind: QUESTION_KINDS[question.id],
    }))),
  }),
]));

function toDayNumber(value) {
  const day = Number(value);
  return Number.isInteger(day) && day >= 1 && day <= 28 ? day : null;
}

function getVisibleText(dailyContent, keys) {
  for (const key of keys) {
    const value = dailyContent?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

/**
 * T11 answers are informational prepared content only. They do not approve
 * daily exercises, assign a subtype, or bypass the daily-content safety gate.
 */
export function answerT11DailyPreparedQuestion({ day, message, dailyContent } = {}) {
  const dayNumber = toDayNumber(day);
  if (!dayNumber || !dailyContent || typeof dailyContent !== 'object') return null;

  const expectedId = `عادت‌های تکراری-${String(dayNumber).padStart(2, '0')}`;
  if (dailyContent.id !== expectedId
    || Number(dailyContent.day) !== dayNumber
    || (dailyContent.topic_id != null && dailyContent.topic_id !== 'T11')) return null;

  const guide = GUIDES.get(dayNumber);
  const question = guide?.questions.find((item) => item.value === String(message || '').trim());
  if (!question || !question.answer) return null;

  let body = question.answer;
  const exercise = getVisibleText(dailyContent, ['exercise', 'exerciseText']);
  const action = getVisibleText(dailyContent, ['actionText', 'action']);
  const lightExercise = getVisibleText(dailyContent, ['lightExerciseText', 'lightExercise']);
  const lightAction = getVisibleText(dailyContent, ['lightActionText', 'lightAction']);

  if (question.id === 'q01' && exercise) {
    body += `\n\n**متن تمرین همین روز در برنامه:** ${exercise}`;
  }
  if (question.id === 'q02' && exercise) {
    body += `\n\n**تمرین واقعی همین روز:** ${exercise}`;
  }
  if (question.id === 'q03' && action) {
    body += `\n\n**متن اقدام اختصاصی همین روز در برنامه:** ${action}`;
  }
  if (question.id === 'q04' && action) {
    body += `\n\n**اقدام واقعی همین روز:** ${action}`;
  }
  if (question.id === 'q05') {
    if (lightExercise) body += `\n\n**نسخه سبک تمرین:** ${lightExercise}`;
    if (lightAction) body += `\n\n**نسخه سبک اقدام:** ${lightAction}`;
  }

  return `راهنمای روز ${dayNumber} عادت‌های تکراری — ${guide.title}\n\n${body}`;
}

export function getT11DailyAssistantPromptGroups(day) {
  const dayNumber = toDayNumber(day);
  const guide = GUIDES.get(dayNumber);
  if (!guide) return [];

  const questions = guide.questions;
  return [
    { label: `فهم تمرین روز ${dayNumber}`, questions: questions.filter((item) => ['q01', 'q02'].includes(item.id)) },
    { label: `فهم اقدام اختصاصی روز ${dayNumber}`, questions: questions.filter((item) => ['q03', 'q04'].includes(item.id)) },
    { label: 'تفاوت تمرین و اقدام', questions: questions.filter((item) => item.id === 'q09') },
    { label: 'اجرا و موانع', questions: questions.filter((item) => ['q05', 'q08', 'q10', 'q13', 'q14'].includes(item.id)) },
    { label: 'ارزیابی و ایمنی', questions: questions.filter((item) => ['q06', 'q07', 'q11', 'q12'].includes(item.id)) },
  ];
}

export const T11_DAILY_ASSISTANT_GUIDES = ANSWERS.records;
