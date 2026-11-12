import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GRIEF_DAILY_ASSISTANT_GUIDES,
  answerGriefDailyPreparedQuestion,
  getGriefDailyAssistantPromptGroups,
} from '../src/features/assistant/griefDailyAssistantPrompts.js';
import { makePageAssistantTurn } from '../src/features/assistant/pageAssistantTurn.js';
import { getCanonicalDailyRecordId } from '../src/features/content/dailyContentSelector.js';

test('T06 contains 28 complete days and 14 unchanged prepared questions per day', () => {
  assert.equal(GRIEF_DAILY_ASSISTANT_GUIDES.length, 28);
  const expectedQuestions = GRIEF_DAILY_ASSISTANT_GUIDES[0].questions.map((q) => q.value);
  for (const guide of GRIEF_DAILY_ASSISTANT_GUIDES) {
    assert.ok(guide.title && guide.objective && guide.skill && guide.mechanism);
    assert.ok(guide.exercise && guide.action && guide.exerciseExample && guide.actionExample);
    assert.equal(guide.questions.length, 14);
    assert.equal(new Set(guide.questions.map((q) => q.value)).size, 14);
    assert.deepEqual(guide.questions.map((q) => q.value), expectedQuestions);
    assert.ok(/^T06-S0[1-3]$/.test(guide.subtopic));
  }
});

test('T06 prompt groups preserve the shared five-section structure for all 28 days', () => {
  for (let day = 1; day <= 28; day += 1) {
    const groups = getGriefDailyAssistantPromptGroups(day);
    assert.deepEqual(groups.map((group) => group.questions.length), [2, 2, 1, 5, 4]);
    assert.deepEqual(groups.map((group) => group.label), [
      'فهم تمرین روز ' + day,
      'فهم اقدام اختصاصی روز ' + day,
      'تفاوت تمرین و اقدام',
      'اجرا و موانع',
      'ارزیابی و ایمنی',
    ]);
  }
  assert.deepEqual(getGriefDailyAssistantPromptGroups(29), []);
  assert.deepEqual(getGriefDailyAssistantPromptGroups(0), []);
});

test('all 392 T06 prepared questions return substantive and meaningfully varied answers', () => {
  let count = 0;
  const answers = new Set();
  for (const guide of GRIEF_DAILY_ASSISTANT_GUIDES) {
    for (const question of guide.questions) {
      const answer = answerGriefDailyPreparedQuestion({
        day: guide.day,
        message: question.value,
        dailyContent: { exercise: guide.exercise, actionText: guide.action },
      });
      assert.ok(answer && answer.length >= 450, 'missing/short answer day ' + guide.day + ' ' + question.kind);
      assert.match(answer, /راهنمای روز/);
      assert.ok(answer.includes(guide.title), 'answer must identify the exact day title');
      assert.notEqual(answer.trim(), guide.exercise, 'answer must teach beyond repeating the exercise');
      assert.notEqual(answer.trim(), guide.action, 'answer must teach beyond repeating the action');
      switch (question.kind) {
        case 'exercise_meaning':
          assert.ok(answer.includes(guide.exercise) && answer.includes(guide.mechanism) && answer.includes(guide.skill));
          break;
        case 'exercise_example':
          assert.ok(answer.includes(guide.exerciseExample) && answer.includes(guide.exercise) && answer.includes(guide.successCriterion));
          break;
        case 'action_meaning':
          assert.ok(answer.includes(guide.action) && answer.includes('تمرین کمک می‌کند'));
          break;
        case 'action_example':
          assert.ok(answer.includes(guide.actionExample) && answer.includes(guide.action));
          break;
        case 'light_version':
          assert.ok(answer.includes(guide.lightVersion) && answer.includes(guide.progressVersion) && answer.includes(guide.restVersion));
          break;
        case 'success':
          assert.ok(answer.includes(guide.successCriterion) && answer.includes(guide.reflectionQuestion));
          break;
        case 'stop':
          assert.ok(answer.includes(guide.stopCondition) && answer.includes('خدمات اضطراری'));
          break;
        case 'no_event':
        case 'not_done':
          assert.ok(answer.includes(guide.lightVersion) && answer.includes('جبران'));
          break;
        case 'exercise_action_difference':
          assert.ok(answer.includes(guide.exercise) && answer.includes(guide.action));
          break;
        case 'grief_increased':
          assert.ok(answer.includes(guide.stopCondition) && answer.includes('خدمات اضطراری'));
          break;
        case 'talk_other':
          assert.ok(answer.includes('فرد امن') && answer.includes('اجباری'));
          break;
        case 'can_change':
          assert.ok(answer.includes(guide.lightVersion) && answer.includes('چه چیزی را تغییر ندهی'));
          break;
        case 'duration':
          assert.ok(answer.includes('زمان ثابت') && answer.includes(guide.successCriterion));
          break;
        default:
          assert.fail('unexpected question kind: ' + question.kind);
      }
      answers.add(answer);
      count += 1;
    }
  }
  assert.equal(count, 392);
  assert.ok(answers.size > 300, 'answers must be meaningfully varied across day/question pairs');
  assert.equal(answerGriefDailyPreparedQuestion({ day: 1, message: 'سؤال آزاد خارج از فهرست' }), null);
  assert.equal(answerGriefDailyPreparedQuestion({ day: 29, message: GRIEF_DAILY_ASSISTANT_GUIDES[0].questions[0].value }), null);
});

test('T06 support-request day requires explicit relationship safety confirmation', () => {
  const guide = GRIEF_DAILY_ASSISTANT_GUIDES.find((item) => item.day === 15);
  const question = guide.questions.find((item) => item.kind === 'action_meaning');
  const data = {
    id: getCanonicalDailyRecordId('غم و سوگ', 15),
    topic_id: 'T06',
    day: 15,
    exercise: guide.exercise,
    actionText: guide.action,
  };
  const base = {
    screen: 'day',
    text: question.value,
    dailyContext: { day: 15, problem: 'غم و سوگ', data },
  };
  const pending = makePageAssistantTurn(base);
  assert.equal(pending.status, 'relationship_safety_confirmation_required');
  assert.match(pending.message, /هر دو نفر می‌توانند آزادانه گفت‌وگو را رد یا متوقف کنند/);

  const unsafe = makePageAssistantTurn({
    ...base,
    dailyContext: { ...base.dailyContext, relationshipSafetyResponse: 'unsafe' },
  });
  assert.equal(unsafe.status, 'relationship_safety_blocked');
  assert.match(unsafe.message, /وارد گفت‌وگوی مستقیم/);

  const safe = makePageAssistantTurn({
    ...base,
    dailyContext: { ...base.dailyContext, relationshipSafetyConfirmed: true, relationshipSafetyResponse: 'safe' },
  });
  assert.equal(safe.status, 'daily_guidance_available');
  assert.match(safe.message, /اقدام اختصاصی امروز/);
});

test('T06 non-interpersonal day-one prepared guidance does not receive an unrelated relationship gate', () => {
  const guide = GRIEF_DAILY_ASSISTANT_GUIDES[0];
  const question = guide.questions[0];
  const result = makePageAssistantTurn({
    screen: 'day',
    text: question.value,
    dailyContext: {
      day: 1,
      problem: 'غم و سوگ',
      data: {
        id: getCanonicalDailyRecordId('غم و سوگ', 1),
        topic_id: 'T06',
        day: 1,
        exercise: guide.exercise,
        actionText: guide.action,
      },
    },
  });
  assert.equal(result.status, 'daily_guidance_available');
  assert.match(result.message, /راهنمای روز/);
});
