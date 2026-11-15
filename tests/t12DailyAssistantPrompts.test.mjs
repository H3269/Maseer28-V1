import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  answerT12DailyPreparedQuestion,
  getT12DailyAssistantPromptGroups,
  T12_DAILY_ASSISTANT_GUIDES,
} from '../src/features/assistant/t12DailyAssistantPrompts.js';
import { makePageAssistantTurn } from '../src/features/assistant/pageAssistantTurn.js';
import { getInterpersonalPrivacyNotice, getRelationshipSafetyGate } from '../src/features/journey/relationshipSafetyGate.js';
import { getDailySafetyMode } from '../src/features/content/dailySafety.js';
import { mergeDailyTextOverrides } from '../src/features/content/dailyTextOverrides.js';

const readJson = async (relativePath) => JSON.parse(await readFile(new URL(relativePath, import.meta.url), 'utf8'));
const topicName = 'مرزبندی و نه گفتن';
const idFor = (day) => topicName + '-' + String(day).padStart(2, '0');

test('T12 assistant catalog covers 28 days and 392 complete fixed questions', () => {
  assert.equal(T12_DAILY_ASSISTANT_GUIDES.length, 28);
  for (const [index, guide] of T12_DAILY_ASSISTANT_GUIDES.entries()) {
    assert.equal(guide.day, index + 1);
    assert.equal(guide.topicId, 'T12');
    assert.equal(guide.topic, topicName);
    assert.equal(guide.questions.length, 14);
    assert.equal(new Set(guide.questions.map((q) => q.id)).size, 14);
    assert.ok(guide.lightActionVersion?.trim());
    assert.ok(guide.restActionVersion?.trim());
    assert.ok(guide.questions.every((q) => q.value === q.label && q.answer?.trim()));
    assert.ok(guide.exercise?.trim());
    assert.ok(guide.action?.trim());
    assert.ok(guide.subtopicIds.length === 1);
    assert.ok(['T12-S01', 'T12-S02', 'T12-S03'].includes(guide.subtopicIds[0]));
    assert.equal(guide.reviewStatus, 'pending_owner_review');
    assert.equal(guide.evidenceGrade, 'not_assessed');
    assert.deepEqual(guide.sourceIds, []);
  }
  const allAnswers = T12_DAILY_ASSISTANT_GUIDES.flatMap((guide) => guide.questions.map((question) => question.answer));
  assert.equal(T12_DAILY_ASSISTANT_GUIDES.reduce((sum, guide) => sum + guide.questions.length, 0), 392);
  assert.equal(new Set(allAnswers).size, 392, 'all 392 day-specific answers must be textually unique');
});

test('T12 question groups preserve the shared five-group UI and exact 14-question coverage', () => {
  for (let day = 1; day <= 28; day += 1) {
    const groups = getT12DailyAssistantPromptGroups(day);
    assert.equal(groups.length, 5);
    assert.equal(groups.flatMap((group) => group.questions).length, 14);
    assert.equal(new Set(groups.flatMap((group) => group.questions.map((q) => q.value))).size, 14);
  }
  assert.deepEqual(getT12DailyAssistantPromptGroups(0), []);
  assert.deepEqual(getT12DailyAssistantPromptGroups(29), []);
});

test('T12 prepared answers require exact canonical topic/day and exact visible exercise/action', () => {
  for (const guide of T12_DAILY_ASSISTANT_GUIDES) {
    const dailyContent = {
      id: idFor(guide.day),
      day: guide.day,
      topic_id: 'T12',
      exercise: guide.exercise,
      actionText: guide.action,
    };
    for (const question of guide.questions) {
      const answer = answerT12DailyPreparedQuestion({ day: guide.day, message: question.value, dailyContent });
      assert.equal(typeof answer, 'string', 'day ' + guide.day + ' ' + question.id);
      assert.match(answer, new RegExp('راهنمای روز ' + guide.day));
    }
    assert.equal(answerT12DailyPreparedQuestion({
      day: guide.day,
      message: guide.questions[0].value,
      dailyContent: { ...dailyContent, id: idFor(guide.day === 28 ? 27 : guide.day + 1) },
    }), null);
    assert.equal(answerT12DailyPreparedQuestion({
      day: guide.day,
      message: guide.questions[0].value,
      dailyContent: { ...dailyContent, exercise: 'تمرین نامنطبق' },
    }), null);
  }
});

test('T12 page assistant routes all exact day-specific questions and rejects wrong identity', () => {
  for (const guide of T12_DAILY_ASSISTANT_GUIDES) {
    const id = idFor(guide.day);
    const source = { id, day: guide.day, topic_id: 'T12' };
    const guidanceData = {
      id,
      day: guide.day,
      topic_id: 'T12',
      exercise: guide.exercise,
      action: 'برای مسئله «مرزبندی و نه گفتن»، ' + guide.action,
    };
    for (const question of guide.questions) {
      const result = makePageAssistantTurn({
        screen: 'day',
        text: question.value,
        dailyContext: {
          day: guide.day,
          problem: topicName,
          data: source,
          guidanceData,
          relationshipSafetyConfirmed: [6, 11, 15, 24, 25].includes(guide.day),
        },
      });
      assert.equal(result.status, 'daily_guidance_available', 'day ' + guide.day + ' ' + question.id);
      assert.match(result.message, new RegExp('راهنمای روز ' + guide.day));
    }
  }
  const wrong = makePageAssistantTurn({
    screen: 'day',
    text: T12_DAILY_ASSISTANT_GUIDES[0].questions[0].value,
    dailyContext: {
      day: 1,
      problem: topicName,
      data: { id: idFor(2), day: 1, topic_id: 'T12' },
      guidanceData: { id: idFor(2), day: 1, topic_id: 'T12' },
    },
  });
  assert.equal(wrong.status, 'daily_guidance_unavailable');
});

test('T12 days 15 and 24 teach distinct skills: stating a limit versus negotiating options', () => {
  const day15 = T12_DAILY_ASSISTANT_GUIDES[14];
  const day24 = T12_DAILY_ASSISTANT_GUIDES[23];
  assert.match(day15.exercise, /جمله اول‌شخص/u);
  assert.match(day24.exercise, /حد غیرقابل مذاکره/u);
  assert.match(day24.exercise, /ترجیح قابل مذاکره/u);
  assert.notEqual(day15.exercise, day24.exercise);
});

test('T12 day 13 clarifies scope and commitment, not emotional negotiation', () => {
  const day13 = T12_DAILY_ASSISTANT_GUIDES[12];
  assert.match(day13.exercise, /خروجی مورد انتظار، مهلت، مسئولیت/u);
  assert.match(day13.action, /تعهد قطعی نده/u);
});

test('T12 day 25 screens for boundary-related danger without diagnosing risk', () => {
  const day25 = T12_DAILY_ASSISTANT_GUIDES[24];
  assert.match(day25.exercise, /برای آزمایش‌کردن مرز اقدام مستقیم نکن/u);
  assert.match(day25.exercise, /ارزیابی حرفه‌ای خطر نیست/u);
});

test('T12 day 14 identifies context and support, not behavior reduction', () => {
  const day14 = T12_DAILY_ASSISTANT_GUIDES[13];
  assert.match(day14.exercise, /عامل زمینه‌ای/u);
  assert.match(day14.exercise, /هدف کاهش یک رفتار محافظتی.*نیست/u);
});

test('T12 day 24 negotiation is offered only in safe, voluntary relationships', () => {
  const day24 = T12_DAILY_ASSISTANT_GUIDES[23];
  assert.match(day24.exercise, /فقط در رابطه امن/u);
  assert.match(day24.action, /فقط در رابطه امن/u);
  assert.match(day24.stopCondition, /رابطه ناامن/u);
});

test('T12 relationship gate covers the four communication days and the day-25 safety-planning day', () => {
  for (const day of [6, 11, 15, 24, 25]) {
    const guide = T12_DAILY_ASSISTANT_GUIDES[day - 1];
    const record = { id: idFor(day), day, topic_id: 'T12' };
    const guidanceData = {
      ...record,
      exercise: guide.exercise,
      action: 'برای مسئله «مرزبندی و نه گفتن»، ' + guide.action,
    };
    assert.ok(getRelationshipSafetyGate(record), 'day ' + day);
    const blocked = makePageAssistantTurn({
      screen: 'day',
      text: guide.questions[0].value,
      dailyContext: { day, problem: topicName, data: record, guidanceData },
    });
    assert.equal(blocked.status, 'relationship_safety_confirmation_required');
  }
  for (const day of [1, 2, 3, 11, 12, 13, 14, 15, 16, 17, 18, 20, 21, 22, 24, 25, 26, 27, 28]) {
    assert.match(getInterpersonalPrivacyNotice({ id: idFor(day), day, topic_id: 'T12' }), /ذخیره|نظارت/u,
      'T12 day ' + day + ' must show a privacy notice before sensitive entry');
  }
  assert.equal(getInterpersonalPrivacyNotice({ id: idFor(5), day: 5, topic_id: 'T12' }), null);
});

test('T12 safety answers use the topic-specific safety notice, not the generic clinic promotion', () => {
  for (const guide of T12_DAILY_ASSISTANT_GUIDES) {
    for (const id of ['q07', 'q11', 'q12']) {
      const question = guide.questions.find((q) => q.id === id);
      const answer = answerT12DailyPreparedQuestion({
        day: guide.day,
        message: question.value,
        dailyContent: {
          id: idFor(guide.day), day: guide.day, topic_id: 'T12',
          exercise: guide.exercise, actionText: guide.action,
        },
      });
      assert.match(answer, /ایمنی|حمایت/u);
      assert.doesNotMatch(answer, /مرکز هیپنوتراپی شفا/u);
    }
  }
});

test('T12 runtime overlay carries proposed metadata but remains blocked pending review', async () => {
  const [base, overrides, guide] = await Promise.all([
    readJson('../public/content/path-content.json'),
    readJson('../public/content/daily-text-overrides.v1.json'),
    readJson('../src/features/assistant/t12DailyAssistantGuide.v1.json'),
  ]);
  const merged = mergeDailyTextOverrides(base, overrides);
  const category = merged.categories[topicName];
  assert.equal(category.days.length, 28);
  for (const day of category.days) {
    const record = guide.records[day.day - 1];
    assert.equal(day.review_status, 'pending_owner_review');
    assert.deepEqual(day.subtopic_ids, [record.subtopicId]);
    assert.equal(day.exercise, record.exercise);
    assert.equal(day.actionText, record.action);
    assert.ok(day.lightActionText?.trim());
    assert.ok(day.restActionText?.trim());
    assert.equal(day.evidence_grade, 'not_assessed');
    assert.deepEqual(day.source_ids, []);
    assert.equal(getDailySafetyMode(day), 'blocked');
    if (record.subtopicId === 'T12-S03') {
      assert.equal(day.risk_level, 'caution');
      assert.deepEqual(day.safety_rule_ids, ['SR-T12-RELATIONSHIP-SAFETY']);
    }
  }
});

test('T12 titles, exercises, actions and daily variants have no exact or high-similarity cross-topic duplicates', async () => {
  const overrides = await readJson('../public/content/daily-text-overrides.v1.json');
  const categories = overrides.categories;
  const t12Days = categories[topicName].days;
  const fields = ['title', 'exercise', 'actionText', 'lightExerciseText', 'lightActionText', 'progressActionText', 'restExerciseText', 'restActionText'];
  const stopWords = new Set([
    'نسخه', 'سبک', 'تمرین', 'اقدام', 'فقط', 'یک', 'و', 'یا', 'را', 'از', 'به',
    'در', 'که', 'اگر', 'برای', 'با', 'بدون', 'امروز', 'فعلا', 'کن', 'کنید',
    'بنویس', 'بنویسی', 'بنویسید', 'ثبت', 'انتخاب', 'نام', 'ببر', 'مشخص',
    'بررسی', 'انجام', 'بده', 'بگیر', 'دارد', 'هست', 'است', 'میشود', 'شود',
    'تا', 'خودت', 'خود', 'او', 'این', 'آن', 'همان', 'هر', 'هیچ', 'همه',
  ]);
  const normalize = (value) => String(value || '').normalize('NFKC')
    .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[^\\p{L}\\p{N}\\s]/gu, ' ')
    .replace(/\\s+/g, ' ').trim().toLowerCase();
  const tokenSet = (value) => new Set(
    normalize(value).split(' ').filter(token => token.length > 2 && !stopWords.has(token)),
  );

  for (const field of fields) {
    const seen = new Set();
    for (const day of t12Days) {
      const value = normalize(day[field]);
      if (!value) continue;
      assert.equal(seen.has(value), false, 'duplicate T12 ' + field + ' across days: ' + day.day);
      seen.add(value);
      const target = tokenSet(day[field]);
      for (const [otherTopic, category] of Object.entries(categories)) {
        if (otherTopic === topicName) continue;
        for (const other of category.days || []) {
          const candidate = tokenSet(other[field]);
          const union = new Set([...target, ...candidate]);
          let intersection = 0;
          for (const token of target) if (candidate.has(token)) intersection += 1;
          const similarity = union.size ? intersection / union.size : 0;
          assert.ok(similarity < (field === 'title' ? 0.50 : 0.30),
            'high-similarity T12 day ' + day.day + ' text with ' + otherTopic + ' day ' + other.day + ' for ' + field + ': ' + similarity);
        }
      }
    }
  }
});
