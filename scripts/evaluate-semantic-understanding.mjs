import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  createAssessmentSession,
  submitAssessmentAnswer,
} from '../src/features/assistant/assessmentEngine.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const datasetPath = path.join(root, 'public/assistant/evaluation/semantic-evaluation-cases.v1.json');

function answer(session, value) {
  return submitAssessmentAnswer(session, value);
}

function runCase(item) {
  let session = createAssessmentSession();
  session = answer(session, item.text);
  const safetyCueDetected = session.safety_context_flag === true;
  const expectedSafetyHandoff = item.must_handoff_safety === true;
  if (expectedSafetyHandoff) {
    return {
      id: item.id,
      expected: item.expected_topics ?? [],
      predicted: [],
      safetyCueDetected,
      expectedSafetyHandoff,
      topic_scoring_excluded: true,
      clarification_scoring_excluded: true,
      expectedClarification: item.must_ask_clarification === true,
      clarificationRequested: false,
      stopped: true,
    };
  }
  if (session.current_question?.id === 'safety_now') session = answer(session, 'نه');
  if (session.status !== 'in_progress') {
    return { id: item.id, expected: item.expected_topics ?? [], predicted: [], safetyCueDetected, stopped: true };
  }

  session = answer(session, 'در زندگی روزمره‌ام اثر گذاشته است');
  session = answer(session, 'چند هفته یا چند ماه است؛ بسته به مورد');
  session = answer(session, 'می‌خواهم مسئله‌ام را بهتر بفهمم');
  session = answer(session, item.text);
  const summary = session.summary;
  return {
    id: item.id,
    expected: item.expected_topics ?? [],
    predicted: (summary?.candidate_topics ?? []).map((candidate) => candidate.topic_id),
    safetyCueDetected,
    expectedSafetyHandoff: false,
    topic_scoring_excluded: false,
    clarification_scoring_excluded: false,
    expectedClarification: item.must_ask_clarification === true,
    clarificationRequested: session.current_question?.id === 'summary_confirmation' || Boolean(summary),
    stopped: false,
  };
}

export function evaluateDataset(dataset) {
  const cases = dataset.cases.map(runCase);
  const tp = new Set();
  const fp = new Set();
  const fn = new Set();
  const perTopic = {};

  for (const result of cases.filter((item) => !item.topic_scoring_excluded)) {
    const expected = new Set(result.expected);
    const predicted = new Set(result.predicted);
    for (const id of expected) {
      if (predicted.has(id)) tp.add(`${result.id}:${id}`);
      else fn.add(`${result.id}:${id}`);
      perTopic[id] ??= { expected: 0, predicted: 0, true_positive: 0 };
      perTopic[id].expected += 1;
    }
    for (const id of predicted) {
      perTopic[id] ??= { expected: 0, predicted: 0, true_positive: 0 };
      perTopic[id].predicted += 1;
      if (expected.has(id)) perTopic[id].true_positive += 1;
      else fp.add(`${result.id}:${id}`);
    }
  }

  const precision = tp.size + fp.size ? tp.size / (tp.size + fp.size) : 0;
  const recall = tp.size + fn.size ? tp.size / (tp.size + fn.size) : 0;
  const clarificationCases = cases.filter((item) => !item.clarification_scoring_excluded);
  const clarificationTp = clarificationCases.filter((item) => item.expectedClarification && item.clarificationRequested).length;
  const clarificationFp = clarificationCases.filter((item) => !item.expectedClarification && item.clarificationRequested).length;
  const clarificationFn = clarificationCases.filter((item) => item.expectedClarification && !item.clarificationRequested).length;
  const clarificationPrecision = clarificationTp + clarificationFp ? clarificationTp / (clarificationTp + clarificationFp) : 0;
  const clarificationRecall = clarificationTp + clarificationFn ? clarificationTp / (clarificationTp + clarificationFn) : 0;
  const safetyCases = cases.filter((item) => item.expectedSafetyHandoff);
  const safetyCueHits = safetyCases.filter((item) => item.safetyCueDetected).length;
  const topicCases = cases.filter((item) => !item.topic_scoring_excluded);

  return {
    dataset_id: dataset.dataset_id,
    dataset_status: dataset.status,
    case_count: cases.length,
    topic_scoring_case_count: topicCases.length,
    topic_metrics: {
      true_positive: tp.size,
      false_positive: fp.size,
      false_negative: fn.size,
      precision: Number(precision.toFixed(4)),
      recall: Number(recall.toFixed(4)),
      f1: precision + recall ? Number((2 * precision * recall / (precision + recall)).toFixed(4)) : 0,
      exact_topic_set_match_count: topicCases.filter((item) =>
        [...new Set(item.expected)].sort().join(',') === [...new Set(item.predicted)].sort().join(',')
      ).length,
    },
    clarification_metrics: {
      evaluated_case_count: clarificationCases.length,
      true_positive: clarificationTp,
      false_positive: clarificationFp,
      false_negative: clarificationFn,
      precision: Number(clarificationPrecision.toFixed(4)),
      recall: Number(clarificationRecall.toFixed(4)),
      f1: clarificationPrecision + clarificationRecall
        ? Number((2 * clarificationPrecision * clarificationRecall / (clarificationPrecision + clarificationRecall)).toFixed(4))
        : 0,
      interpretation: 'فقط تطابق با برچسب مصنوعی نیاز به پرسش تکمیلی؛ نه کیفیت بالینی یا کفایت روشن‌سازی',
    },
    safety_lexical_probe: {
      expected_handoff_cases: safetyCases.length,
      lexical_cue_detected: safetyCueHits,
      lexical_cue_missed: safetyCases.length - safetyCueHits,
      interpretation: 'فقط پوشش چند عبارت واژگانی محدود؛ عدم کشف عبارت به معنی ایمن‌بودن نیست و این سنجه اعتبار بالینی ندارد',
    },
    per_topic: Object.fromEntries(Object.entries(perTopic).sort(([a], [b]) => a.localeCompare(b))),
    cases,
    limitations: [
      'داده‌ها مصنوعی و کوچک‌اند و نماینده کاربران فارسی‌زبان نیستند.',
      'این سنجه‌ها عملکرد بالینی، فهم معنایی، تشخیص یا ایمنی را اعتبارسنجی نمی‌کنند.',
      'سناریوهای دارای اولویت ایمنی از امتیاز موضوعی کنار گذاشته می‌شوند تا توقف جریان با خطای دسته‌بندی موضوعی اشتباه نشود.',
      'موتور فعلی تطبیق عبارت‌محور است؛ خروجی آن فهم معنایی واقعی محسوب نمی‌شود.',
      'پاسخ منفی ثابت در اجرای آزمون فقط برای رسیدن به مرحله موضوعی است و هیچ نتیجه ایمنی از آن گرفته نمی‌شود.',
      'نیاز به پرسش تکمیلی در داده مصنوعی نیز سنجیده می‌شود؛ این معیار فقط تطابق با برچسب‌های دستی مصنوعی است و کیفیت پرسش را نمی‌سنجد.',
      'هیچ آستانه پذیرش یا مجوز فعال‌سازی برای کاربران واقعی از این گزارش قابل استنتاج نیست.',
    ],
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dataset = JSON.parse(await readFile(datasetPath, 'utf8'));
  const report = evaluateDataset(dataset);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\\n`);
}
