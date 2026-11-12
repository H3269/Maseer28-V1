import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  GUILT_DAILY_ASSISTANT_GUIDES,
  answerGuiltDailyPreparedQuestion,
  getGuiltDailyAssistantPromptGroups,
} from '../src/features/assistant/guiltDailyAssistantPrompts.js';
import { makePageAssistantTurn } from '../src/features/assistant/pageAssistantTurn.js';
import { getCanonicalDailyRecordId } from '../src/features/content/dailyContentSelector.js';

test('T07 contains 28 complete day guides and 14 fixed questions per day', () => {
  assert.equal(GUILT_DAILY_ASSISTANT_GUIDES.length, 28);
  const expectedQuestions = GUILT_DAILY_ASSISTANT_GUIDES[0].questions.map(question => question.value);
  assert.equal(new Set(GUILT_DAILY_ASSISTANT_GUIDES.map(guide => guide.exerciseExample)).size, 28);
  assert.equal(new Set(GUILT_DAILY_ASSISTANT_GUIDES.map(guide => guide.actionExample)).size, 28);
  for (const field of ['title', 'objective', 'skill', 'mechanism', 'exercise', 'action', 'lightVersion', 'progressVersion', 'restVersion', 'lightActionVersion', 'progressActionVersion', 'restActionVersion', 'successCriterion', 'reflectionQuestion', 'stopCondition']) {
    assert.equal(new Set(GUILT_DAILY_ASSISTANT_GUIDES.map(guide => guide[field])).size, 28,
      'T07 field must be unique across all days: ' + field);
  }
  for (const guide of GUILT_DAILY_ASSISTANT_GUIDES) {
    assert.ok(guide.title && guide.objective && guide.skill && guide.mechanism);
    assert.ok(guide.exercise && guide.action && guide.exerciseExample && guide.actionExample);
    assert.ok(guide.successCriterion && guide.reflectionQuestion && guide.stopCondition);
    assert.ok(guide.lightVersion && guide.progressVersion && guide.restVersion);
    assert.ok(guide.lightActionVersion && guide.progressActionVersion && guide.restActionVersion);
    assert.notEqual(guide.lightActionVersion, guide.lightVersion);
    assert.notEqual(guide.progressActionVersion, guide.progressVersion);
    assert.notEqual(guide.restActionVersion, guide.restVersion);
    assert.notEqual(guide.exerciseExample, guide.actionExample);
    assert.equal(guide.questions.length, 14);
    assert.equal(new Set(guide.questions.map(question => question.value)).size, 14);
    assert.deepEqual(guide.questions.map(question => question.value), expectedQuestions);
    assert.match(guide.subtopic, /^T07-S0[1-3]$/);
    assert.equal(guide.subtopicStatus, 'proposed_pending_expert_review');
  }
});

test('all 28 T07 assistant guides match the full-field editorial draft', async () => {
  const draft = await readFile(new URL('../docs/T07_GUILT_28DAY_REDESIGN_DRAFT_B2_CY_FA.md', import.meta.url), 'utf8');
  const sections = draft.split(/(?=^### روز \d+ — )/m).filter(section => /^### روز \d+ — /m.test(section));
  assert.equal(sections.length, 28);
  const fields = {
    objective: 'هدف',
    skill: 'مهارت',
    mechanism: 'سازوکار',
    exercise: 'تمرین',
    action: 'اقدام',
    lightVersion: 'نسخه سبک',
    progressVersion: 'نسخه پیشرفت',
    restVersion: 'نسخه استراحت',
    successCriterion: 'معیار موفقیت',
    reflectionQuestion: 'پرسش بازتاب',
    stopCondition: 'شرط توقف/احتیاط',
  };
  for (const guide of GUILT_DAILY_ASSISTANT_GUIDES) {
    const section = sections.find(item => new RegExp('^### روز ' + guide.day + ' — ', 'm').test(item));
    assert.ok(section, 'missing T07 draft section for day ' + guide.day);
    for (const [field, label] of Object.entries(fields)) {
      assert.ok(section.includes('- **' + label + ':** ' + guide[field]),
        'draft/runtime mismatch for ' + field + ' on day ' + guide.day);
    }
    assert.ok(section.includes('- **زیرموضوع پیشنهادی:** ' + guide.subtopic));
  }
});

test('T07 prompt groups preserve the five shared sections on every day', () => {
  for (let day = 1; day <= 28; day += 1) {
    const groups = getGuiltDailyAssistantPromptGroups(day);
    assert.deepEqual(groups.map(group => group.questions.length), [2, 2, 1, 5, 4]);
    assert.deepEqual(groups.map(group => group.label), [
      'فهم تمرین روز ' + day,
      'فهم اقدام اختصاصی روز ' + day,
      'تفاوت تمرین و اقدام',
      'اجرا و موانع',
      'ارزیابی و ایمنی',
    ]);
  }
  assert.deepEqual(getGuiltDailyAssistantPromptGroups(0), []);
  assert.deepEqual(getGuiltDailyAssistantPromptGroups(29), []);
});

test('all 392 T07 prepared questions return substantive, day-specific answers', () => {
  let count = 0;
  const answers = new Set();
  for (const guide of GUILT_DAILY_ASSISTANT_GUIDES) {
    for (const question of guide.questions) {
      const answer = answerGuiltDailyPreparedQuestion({
        day: guide.day,
        message: question.value,
        dailyContent: { exercise: guide.exercise, actionText: guide.action },
      });
      assert.ok(answer && answer.length >= 450, 'missing/short answer day ' + guide.day + ' ' + question.kind);
      assert.match(answer, /راهنمای روز/);
      assert.ok(answer.includes('شرم حکم کلی درباره ارزش خود'), 'every T07 answer must preserve the guilt/shame/self-blame boundary');
      assert.ok(answer.includes(guide.title), 'answer must identify the exact day title');
      assert.notEqual(answer.trim(), guide.exercise);
      assert.notEqual(answer.trim(), guide.action);
      switch (question.kind) {
        case 'exercise_meaning':
          assert.ok(answer.includes(guide.exercise) && answer.includes(guide.objective) && answer.includes(guide.mechanism) && answer.includes(guide.skill));
          break;
        case 'exercise_example':
          assert.ok(answer.includes(guide.exerciseExample) && answer.includes(guide.exercise) && answer.includes(guide.successCriterion));
          break;
        case 'action_meaning':
          assert.ok(answer.includes(guide.action) && answer.includes(guide.objective) && answer.includes(guide.skill) && answer.includes('تمرین کمک می‌کند'));
          break;
        case 'action_example':
          assert.ok(answer.includes(guide.actionExample) && answer.includes(guide.action));
          break;
        case 'light_version':
          assert.ok(answer.includes(guide.lightVersion) && answer.includes(guide.progressVersion) && answer.includes(guide.restVersion));
          assert.ok(answer.includes(guide.lightActionVersion) && answer.includes(guide.progressActionVersion) && answer.includes(guide.restActionVersion));
          break;
        case 'success':
          assert.ok(answer.includes(guide.successCriterion) && answer.includes(guide.reflectionQuestion) && answer.includes(guide.exercise) && answer.includes(guide.action));
          break;
        case 'stop':
          assert.ok(answer.includes(guide.stopCondition) && answer.includes('خدمات اضطراری') && answer.includes(guide.exercise) && answer.includes(guide.action));
          break;
        case 'no_event':
        case 'not_done':
          assert.ok(answer.includes(guide.lightVersion) && answer.includes(guide.lightActionVersion) && answer.includes('جبران') && answer.includes(guide.exercise) && answer.includes(guide.action));
          break;
        case 'exercise_action_difference':
          assert.ok(answer.includes(guide.exercise) && answer.includes(guide.action));
          break;
        case 'guilt_increased':
          assert.ok(answer.includes('خودتنبیهی') && answer.includes('خدمات اضطراری') && answer.includes(guide.objective) && answer.includes(guide.stopCondition));
          break;
        case 'talk_other':
          assert.ok(answer.includes('تماس') && answer.includes('رضایت') && answer.includes(guide.objective) && answer.includes(guide.stopCondition));
          break;
        case 'can_change':
          assert.ok(answer.includes(guide.skill) && answer.includes(guide.lightVersion));
          break;
        case 'duration':
          assert.ok(answer.includes(guide.objective) && answer.includes('زمان استاندارد'));
          break;
        default:
          assert.fail('unexpected T07 question kind: ' + question.kind);
      }
      answers.add(answer);
      count += 1;
    }
  }
  assert.equal(count, 392);
  assert.ok(answers.size > 300, 'T07 answers must be meaningfully varied across days and question types');
  assert.equal(answerGuiltDailyPreparedQuestion({ day: 1, message: 'سؤال آزاد خارج از فهرست' }), null);
});

test('T07 daily exercise and action match the runtime overlay and have no exact cross-topic duplicates', async () => {
  const overlay = JSON.parse(await readFile(new URL('../public/content/daily-text-overrides.v1.json', import.meta.url), 'utf8'));
  const categories = overlay.categories || {};
  const guiltDays = categories['احساس گناه']?.days || [];
  assert.equal(guiltDays.length, 28);
  const normalize = value => String(value || '').normalize('NFKC')
    .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[\u200c\u200f\u200e]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ').trim().toLowerCase();
  const seen = new Map();
  for (const guide of GUILT_DAILY_ASSISTANT_GUIDES) {
    const day = guiltDays.find(item => Number(item.day) === guide.day);
    assert.ok(day, 'missing T07 overlay day ' + guide.day);
    assert.equal(day.exercise, guide.exercise, 'exercise mismatch on day ' + guide.day);
    assert.equal(day.actionText, guide.action, 'action mismatch on day ' + guide.day);
    assert.equal(day.title, guide.title, 'title mismatch on day ' + guide.day);
    assert.equal(day.intro, 'هدف: ' + guide.objective + '\n\nمهارت: ' + guide.skill + '\n\nچرایی تمرین: ' + guide.mechanism, 'intro mismatch on day ' + guide.day);
    assert.equal(day.closing, 'معیار موفقیت: ' + guide.successCriterion + '\n\nپرسش بازتاب: ' + guide.reflectionQuestion + '\n\nشرط توقف/احتیاط: ' + guide.stopCondition, 'closing mismatch on day ' + guide.day);
    assert.equal(day.lightExerciseText, 'نسخه سبک تمرین: ' + guide.lightVersion, 'light exercise mismatch on day ' + guide.day);
    assert.equal(day.lightActionText, guide.lightActionVersion, 'light action mismatch on day ' + guide.day);
    assert.equal(day.progressActionText, guide.progressActionVersion, 'progress action mismatch on day ' + guide.day);
    assert.equal(day.restExerciseText, guide.restVersion, 'rest exercise mismatch on day ' + guide.day);
    assert.equal(day.restActionText, guide.restActionVersion, 'rest action mismatch on day ' + guide.day);
    for (const [field, value] of [['exercise', day.exercise], ['actionText', day.actionText], ['lightActionText', day.lightActionText], ['progressActionText', day.progressActionText], ['restActionText', day.restActionText]]) {
      const key = normalize(value);
      assert.ok(key.length > 20);
      assert.equal(seen.has(key), false, 'duplicate T07 text: ' + field + ' day ' + guide.day);
      seen.set(key, { day: guide.day, field });
      for (const [topic, category] of Object.entries(categories)) {
        if (topic === 'احساس گناه') continue;
        for (const other of category.days || []) {
          assert.notEqual(key, normalize(other[field]),
            'T07 exact cross-topic duplicate with ' + topic + ' day ' + other.day);
        }
      }
    }
  }
  const tokenSet = value => new Set(normalize(value).split(' ').filter(token => token.length > 2));
  for (const guide of GUILT_DAILY_ASSISTANT_GUIDES) {
    for (const field of ['exercise', 'actionText', 'lightActionText', 'progressActionText', 'restActionText']) {
      const guideValue = field === 'exercise' ? guide.exercise : field === 'actionText' ? guide.action : field === 'lightActionText' ? guide.lightActionVersion : field === 'progressActionText' ? guide.progressActionVersion : guide.restActionVersion;
      const target = tokenSet(guideValue);
      for (const [topic, category] of Object.entries(categories)) {
        if (topic === 'احساس گناه') continue;
        for (const other of category.days || []) {
          const candidate = tokenSet(other[field]);
          const union = new Set([...target, ...candidate]);
          let intersection = 0;
          for (const token of target) if (candidate.has(token)) intersection += 1;
          const similarity = union.size ? intersection / union.size : 0;
          assert.ok(similarity < 0.30,
            'high-similarity T07 text with ' + topic + ' day ' + other.day + ' for ' + field + ': ' + similarity);
        }
      }
    }
  }
});

test('T07 prepared answers require exact canonical topic/day identity and preserve urgent safety precedence', () => {
  const guide = GUILT_DAILY_ASSISTANT_GUIDES[0];
  const question = guide.questions[0];
  const data = {
    id: getCanonicalDailyRecordId('احساس گناه', 1),
    topic_id: 'T07',
    day: 1,
    exercise: guide.exercise,
    actionText: guide.action,
  };
  const base = {
    screen: 'day',
    text: question.value,
    dailyContext: { day: 1, problem: 'احساس گناه', data },
  };
  const ok = makePageAssistantTurn(base);
  assert.equal(ok.status, 'daily_guidance_available');
  assert.match(ok.message, /راهنمای روز/);
  const wrongTopic = makePageAssistantTurn({
    ...base,
    dailyContext: { ...base.dailyContext, data: { ...data, topic_id: 'T06' } },
  });
  assert.equal(wrongTopic.status, 'daily_guidance_unavailable');
  const wrongDay = makePageAssistantTurn({
    ...base,
    dailyContext: { ...base.dailyContext, day: 2 },
  });
  assert.equal(wrongDay.status, 'daily_guidance_unavailable');
  const free = makePageAssistantTurn({ ...base, text: 'چرا همیشه احساس گناه دارم؟' });
  assert.equal(free.status, 'prepared_question_required');
  const urgent = makePageAssistantTurn({ ...base, text: 'امشب قصد دارم به خودم آسیب بزنم.' });
  assert.equal(urgent.status, 'urgent_human_support_required');
});
