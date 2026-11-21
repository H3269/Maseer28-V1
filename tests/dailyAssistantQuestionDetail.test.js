import { cleanPreparedAssistantTopicText } from '../src/features/assistant/teacherStylePreparedAnswer.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ANXIETY_DAILY_ASSISTANT_GUIDES, answerAnxietyDailyPreparedQuestion } from '../src/features/assistant/anxietyDailyAssistantPrompts.js';
import { FEAR_DAILY_ASSISTANT_GUIDES, answerFearDailyPreparedQuestion } from '../src/features/assistant/fearDailyAssistantPrompts.js';
import { HATRED_DAILY_ASSISTANT_GUIDES, answerHatredDailyPreparedQuestion } from '../src/features/assistant/hatredDailyAssistantPrompts.js';
import { JEALOUSY_DAILY_ASSISTANT_GUIDES, answerJealousyDailyPreparedQuestion } from '../src/features/assistant/jealousyDailyAssistantPrompts.js';
import { GRIEF_DAILY_ASSISTANT_GUIDES, answerGriefDailyPreparedQuestion } from '../src/features/assistant/griefDailyAssistantPrompts.js';
import { GUILT_DAILY_ASSISTANT_GUIDES, answerGuiltDailyPreparedQuestion } from '../src/features/assistant/guiltDailyAssistantPrompts.js';
import { EMOTIONAL_DEPENDENCY_DAILY_ASSISTANT_GUIDES, answerEmotionalDependencyDailyPreparedQuestion } from '../src/features/assistant/emotionalDependencyDailyAssistantPrompts.js';
import { T09_DAILY_ASSISTANT_GUIDES, answerT09DailyPreparedQuestion } from '../src/features/assistant/t09DailyAssistantPrompts.js';
import { T10_DAILY_ASSISTANT_GUIDES, answerT10DailyPreparedQuestion } from '../src/features/assistant/t10DailyAssistantPrompts.js';
import { T11_DAILY_ASSISTANT_GUIDES, answerT11DailyPreparedQuestion } from '../src/features/assistant/t11DailyAssistantPrompts.js';
import { T12_DAILY_ASSISTANT_GUIDES, answerT12DailyPreparedQuestion } from '../src/features/assistant/t12DailyAssistantPrompts.js';
import { T13_DAILY_ASSISTANT_GUIDES, answerT13DailyPreparedQuestion } from '../src/features/assistant/t13DailyAssistantPrompts.js';
import { T14_DAILY_ASSISTANT_GUIDES, answerT14DailyPreparedQuestion } from '../src/features/assistant/t14DailyAssistantPrompts.js';

const topics = [
  ['T02', 'اضطراب', ANXIETY_DAILY_ASSISTANT_GUIDES, answerAnxietyDailyPreparedQuestion],
  ['T03', 'ترس', FEAR_DAILY_ASSISTANT_GUIDES, answerFearDailyPreparedQuestion],
  ['T04', 'نفرت', HATRED_DAILY_ASSISTANT_GUIDES, answerHatredDailyPreparedQuestion],
  ['T05', 'حسادت', JEALOUSY_DAILY_ASSISTANT_GUIDES, answerJealousyDailyPreparedQuestion],
  ['T06', 'غم و سوگ', GRIEF_DAILY_ASSISTANT_GUIDES, answerGriefDailyPreparedQuestion],
  ['T07', 'احساس گناه', GUILT_DAILY_ASSISTANT_GUIDES, answerGuiltDailyPreparedQuestion],
  ['T08', 'وابستگی عاطفی', EMOTIONAL_DEPENDENCY_DAILY_ASSISTANT_GUIDES, answerEmotionalDependencyDailyPreparedQuestion],
  ['T09', 'اهمال‌کاری', T09_DAILY_ASSISTANT_GUIDES, answerT09DailyPreparedQuestion],
  ['T10', 'بی‌خوابی و مشکلات خواب', T10_DAILY_ASSISTANT_GUIDES, answerT10DailyPreparedQuestion],
  ['T11', 'عادت‌های تکراری', T11_DAILY_ASSISTANT_GUIDES, answerT11DailyPreparedQuestion],
  ['T12', 'مرزبندی و نه گفتن', T12_DAILY_ASSISTANT_GUIDES, answerT12DailyPreparedQuestion],
  ['T13', 'تنهایی', T13_DAILY_ASSISTANT_GUIDES, answerT13DailyPreparedQuestion],
  ['T14', 'کمبود انگیزه', T14_DAILY_ASSISTANT_GUIDES, answerT14DailyPreparedQuestion],
];

const detailChecks = [
  ['exercise_meaning', ['هدف تمرین امروز', 'منطق آموزشی', 'متن دقیق تمرین امروز']],
  ['exercise_example', ['تمرین دقیق همین روز', 'چطور از مثال استفاده کنی']],
  ['action_meaning', ['منطق انتخاب اقدام', 'اقدام اختصاصی دقیق امروز']],
  ['action_example', ['اقدام اختصاصی دقیق همین روز', 'چطور مثال را با شرایط خودت تطبیق بدهی']],
];

test('T02-T14 all 364 day records return expanded, day-specific teaching answers for the four core questions', () => {
  let checked = 0;
  for (const [topicId, topic, guides, answerPrepared] of topics) {
    assert.equal(guides.length, 28, topicId + ' must have 28 days');
    for (const guide of guides) {
      const needsDailyContent = Number(topicId.slice(1)) >= 9;
      const dailyContent = needsDailyContent ? {
        id: topic + '-' + String(guide.day).padStart(2, '0'),
        topic_id: topicId,
        day: guide.day,
        title: guide.title,
        exercise: guide.exercise,
        actionText: guide.action,
        sourceExercise: guide.exercise,
        sourceActionText: guide.action,
      } : undefined;
      for (const [kind, requiredLabels] of detailChecks) {
        const question = guide.questions.find((item) => item.kind === kind);
        assert.ok(question, topicId + ' day ' + guide.day + ' missing ' + kind);
        const answer = answerPrepared({ day: guide.day, message: question.value, dailyContent });
        assert.equal(typeof answer, 'string', topicId + ' day ' + guide.day + ' ' + kind + ' must return an answer');
        assert.ok(answer.includes(cleanPreparedAssistantTopicText(guide.title)), topicId + ' day ' + guide.day + ' must preserve exact daily title');
        for (const label of requiredLabels) {
          const anxietyFieldByLabel = {
            'هدف تمرین امروز': guide.objective,
            'منطق آموزشی': guide.mechanism,
            'متن دقیق تمرین امروز': guide.exercise,
            'تمرین دقیق همین روز': guide.exercise,
            'منطق انتخاب اقدام': guide.mechanism,
            'اقدام اختصاصی دقیق امروز': guide.action,
            'اقدام اختصاصی دقیق همین روز': guide.action,
          };
          const alreadyPresentAnxietyField = topicId === 'T02'
            && typeof anxietyFieldByLabel[label] === 'string'
            && answer.includes(anxietyFieldByLabel[label]);
          const preservedUnderCanonicalAnxietyHeading = topicId === 'T02'
            && ((label === 'چطور از مثال استفاده کنی' && answer.includes('مثال فقط برای فهم قالب'))
              || (label === 'چطور مثال را با شرایط خودت تطبیق بدهی' && answer.includes('فقط بخش امن، داوطلبانه')));
          assert.ok(answer.includes(label) || alreadyPresentAnxietyField || preservedUnderCanonicalAnxietyHeading,
            topicId + ' day ' + guide.day + ' ' + kind + ' missing detail section: ' + label);
        }
        if (topicId === 'T02') {
          assert.doesNotMatch(answer, /توضیح این مورد در متن بالا آمده است/,
            'anxiety day ' + guide.day + ' ' + kind + ' must not use duplicate-content placeholders');
        }
        checked += 1;
      }
    }
  }
  assert.equal(checked, 13 * 28 * 4);
});

test('expanded examples remain explicitly illustrative and do not force exposure or invented experience', () => {
  for (const [topicId, topic, guides, answerPrepared] of topics) {
    for (const guide of guides) {
      const dailyContent = Number(topicId.slice(1)) >= 9 ? {
        id: topic + '-' + String(guide.day).padStart(2, '0'),
        topic_id: topicId,
        day: guide.day,
        title: guide.title,
        exercise: guide.exercise,
        actionText: guide.action,
        sourceExercise: guide.exercise,
        sourceActionText: guide.action,
      } : undefined;
      for (const kind of ['exercise_example', 'action_example']) {
        const question = guide.questions.find((item) => item.kind === kind);
        const answer = answerPrepared({ day: guide.day, message: question.value, dailyContent });
        assert.match(answer, /مثال|نمونه/u, topicId + ' day ' + guide.day + ' ' + kind + ' must retain example framing');
        assert.match(answer, /اجباری نیست|نسخه اجباری نیست|عیناً به‌عنوان تجربه شخصی ثبت/u, topicId + ' day ' + guide.day + ' ' + kind + ' must not present an example as a mandatory personal experience');
      }
    }
  }
});
