import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDailyAssistantContext } from '../src/features/assistant/dailyAssistantContext.js';

test('daily assistant context keeps canonical examples while applying visible adaptations', () => {
  const source = {
    id: 'حسادت-01',
    topic_id: 'T05',
    day: 1,
    exercise: 'تمرین اصلی روز اول',
    actionText: 'اقدام اصلی روز اول',
    exerciseExample: 'مثال تأییدشده تمرین',
    actionExample: 'مثال تأییدشده اقدام',
    risk_level: 'routine',
  };
  const guidanceData = {
    id: source.id,
    topic_id: source.topic_id,
    day: source.day,
    title: 'عنوان نمایشی',
    exercise: 'نسخه سازگارشده تمرین',
    action: 'نسخه سازگارشده اقدام',
    adaptation: 'یادداشت سازگاری',
  };

  const resolved = resolveDailyAssistantContext({
    day: 1,
    problem: 'حسادت',
    data: source,
    guidanceData,
  });

  assert.equal(resolved.supportedTopic, true);
  assert.equal(resolved.canonicalIdentity, true);
  assert.equal(resolved.topicId, 'T05');
  assert.equal(resolved.visibleContent.exercise, 'نسخه سازگارشده تمرین');
  assert.equal(resolved.visibleContent.actionText, 'نسخه سازگارشده اقدام');
  assert.equal(resolved.visibleContent.exerciseExample, source.exerciseExample);
  assert.equal(resolved.visibleContent.actionExample, source.actionExample);
  assert.equal(resolved.visibleContent.sourceExercise, source.exercise);
  assert.equal(resolved.visibleContent.sourceActionText, source.actionText);
  assert.equal(resolved.visibleContent.risk_level, 'routine');
});

test('daily assistant context rejects guidance copied from a different day record', () => {
  const source = {
    id: 'حسادت-01', topic_id: 'T05', day: 1,
    exercise: 'تمرین روز اول', actionText: 'اقدام روز اول',
    exerciseExample: 'مثال روز اول',
  };
  const resolved = resolveDailyAssistantContext({
    day: 1,
    problem: 'حسادت',
    data: source,
    guidanceData: { id: 'حسادت-02', topic_id: 'T05', day: 2, exercise: 'متن روز دوم' },
  });

  assert.equal(resolved.canonicalIdentity, true);
  assert.equal(resolved.visibleContent, null);
});
