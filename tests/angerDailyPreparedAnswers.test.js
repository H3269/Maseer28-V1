import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ANGER_DAILY_ASSISTANT_GUIDES,
  answerAngerDailyPreparedQuestion,
} from '../src/features/assistant/angerDailyAssistantPrompts.js';

const QUESTION_KINDS = new Set([
  'exercise_meaning', 'exercise_example', 'action_meaning', 'action_example',
  'light_version', 'success', 'stop', 'no_event', 'exercise_action_difference',
  'not_done', 'anger_increased', 'talk_other', 'can_change', 'duration',
]);

test('rebuilt anger assistant provides 392 complete day-and-question-specific answers', () => {
  assert.equal(ANGER_DAILY_ASSISTANT_GUIDES.length, 28);
  const answers = new Set();
  let count = 0;

  for (const guide of ANGER_DAILY_ASSISTANT_GUIDES) {
    assert.equal(guide.questions.length, 14, 'day ' + guide.day + ' must retain all 14 approved questions');
    assert.equal(guide.topicId, 'T01');
    for (const question of guide.questions) {
      assert.ok(QUESTION_KINDS.has(question.kind), 'unknown question kind ' + question.kind);
      const answer = answerAngerDailyPreparedQuestion({ day: guide.day, message: question.value });
      assert.equal(typeof answer, 'string', 'missing answer ' + guide.day + ':' + question.id);
      assert.ok(answer.length > 250, 'answer too thin ' + guide.day + ':' + question.id);
      assert.doesNotMatch(answer, /آره عزیزم|حتماً عزیزم|بله عزیزم|نه عزیزم|دستیار هوشمند مسیر ۲۸|موضوع: خشم|توضیح و راهنمای امروز|جمع‌بندی امروز|یادآوری مهم درباره ایمنی شما|۰۹۱۹۰۸۸۹۰۶۲/u,
        'T01 answer must contain only the answer body, without repeated framing or the separate reminder card');
      assert.ok(!answer.includes(question.label), 'assistant must not repeat the selected user question');
      assert.ok(answer.trim().length > 0, 'answer body must not be empty ' + guide.day + ':' + question.id);
      answers.add(answer);
      count++;
    }
  }
  assert.equal(count, 392);
  assert.equal(answers.size, 392, 'all 392 rendered answers must be distinct');
});

test('each question type explains the corresponding day-specific exercise, action, example, criterion, or safety limit', () => {
  for (const guide of ANGER_DAILY_ASSISTANT_GUIDES) {
    const byKind = Object.fromEntries(guide.questions.map((q) => [
      q.kind, answerAngerDailyPreparedQuestion({ day: guide.day, message: q.value }),
    ]));
    assert.ok(byKind.exercise_meaning.includes(guide.exercise));
    assert.ok(byKind.exercise_example.includes(guide.exerciseExample));
    assert.ok(byKind.action_meaning.includes(guide.action));
    assert.ok(byKind.action_example.includes(guide.actionExample));
    assert.ok(byKind.light_version.includes(guide.lightVersion));
    assert.ok(byKind.success.includes(guide.successCriterion));
    assert.ok(byKind.stop.includes(guide.stopCondition));
    assert.ok(byKind.no_event.includes(guide.restVersion));
    assert.ok(byKind.exercise_action_difference.includes(guide.exercise));
    assert.ok(byKind.exercise_action_difference.includes(guide.action));
    assert.ok(byKind.anger_increased.includes(guide.stopCondition));
    assert.ok(byKind.can_change.includes(guide.objective));
    assert.match(byKind.talk_other, /گفت‌وگو با فرد دیگری الزامی نیست/u);
    assert.match(byKind.duration, /زمان مشخصی برای این تمرین ثبت نشده/u);
  }
});

test('runtime answers use verified same-day anger content without reverting to the previous prepared-answer bank', () => {
  const guide = ANGER_DAILY_ASSISTANT_GUIDES[0];
  const question = guide.questions[0];
  const answer = answerAngerDailyPreparedQuestion({
    day: guide.day,
    message: question.value,
    dailyContent: {
      topicId: 'T01',
      day: guide.day,
      title: 'عنوان روزِ همگام‌شده',
      exercise: 'تمرین همگام‌شده برای آزمون مسیر اجرا.',
      actionText: 'اقدام همگام‌شده برای آزمون مسیر اجرا.',
    },
  });
  assert.ok(answer.includes('عنوان روزِ همگام‌شده'));
  assert.ok(answer.includes('تمرین همگام‌شده برای آزمون مسیر اجرا.'));
  assert.doesNotMatch(answer, /راهنمای روز 1 خشم — تفکیک رویداد، احساس و رفتار/u);
});

test('unknown days and questions are rejected instead of receiving a generic answer', () => {
  assert.equal(answerAngerDailyPreparedQuestion({ day: 0, message: 'منظور از تمرین امروز چیست؟' }), null);
  assert.equal(answerAngerDailyPreparedQuestion({ day: 1, message: 'یک سؤال خارج از فهرست' }), null);
});
