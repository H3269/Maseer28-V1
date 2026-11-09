import fs from 'node:fs';

const DAY_PHASES = {
  1: 'orientation_and_safe_observation',
  2: 'pattern_discrimination_and_context',
  3: 'functional_context_and_impact',
};
const ALLOW_REVIEWED_SUBTOPIC_REVISITS = new Set(['T14', 'T19', 'T23', 'T32', 'T33']);
const REVIEWED_SUBTOPIC_MAPPINGS = new Map([
  ['DRAFT_T14_D02', 'T14-S01'],
  ['DRAFT_T14_D03', 'T14-S02'],
  ['DRAFT_T19_D02', 'T19-S01'],
  ['DRAFT_T23_D03', 'T23-S02'],
  ['DRAFT_T32_D02', 'T32-S01'],
  ['DRAFT_T33_D03', 'T33-S02'],
]);

const REQUIRED_DRAFT_FIELDS = [
  'learning_objective', 'mechanism_focus', 'exercise',
  'action', 'progress_measure', 'safety_and_limits',
];
const PROGRESSION_FIELDS = [
  'learning_objective', 'mechanism_focus', 'exercise',
  'action', 'progress_measure',
];
const normalizeText = (value) => String(value ?? '').normalize('NFKC').replace(/\\s+/g, ' ').trim();

export function validateContentRedesign({ queue, day1, day2, day3, allDays = null, topics, subtopics, evidenceRegistry = null }) {
  const errors = [];
  const topicList = topics.topics ?? [];
  const topicIds = new Set(topicList.map((item) => item.topic_id));
  const topicNames = new Map(topicList.map((item) => [item.topic_id, item.name]));
  const subById = new Map((subtopics.subtopics ?? []).map((item) => [item.subtopic_id, item]));
  const records = queue.records ?? [];
  const batches = [[1, day1.records ?? []], [2, day2.records ?? []], [3, day3.records ?? []]];
  const drafts = batches.flatMap(([, items]) => items);
  const expected = new Set();

  for (const topic of topicList) {
    for (let day = 1; day <= 28; day++) {
      expected.add('QREV_' + topic.topic_id + '_D' + String(day).padStart(2, '0'));
    }
  }

  const queueBySlot = new Map();
  const queueIds = new Set();
  for (const item of records) {
    if (queueIds.has(item.review_id)) errors.push('duplicate queue id ' + item.review_id);
    queueIds.add(item.review_id);
    if (!topicIds.has(item.topic_id)) errors.push('unknown queue topic ' + item.topic_id);
    if (item.runtime_eligible !== false || item.review_status !== 'pending_review') {
      errors.push('queue item activated or reviewed prematurely ' + item.review_id);
    }
    if (Object.values(item.scores ?? {}).some((value) => value !== null)) {
      errors.push('queue score is not null ' + item.review_id);
    }
    const slot = item.topic_id + ':' + item.day_number;
    if (queueBySlot.has(slot)) errors.push('duplicate queue topic/day slot ' + slot);
    queueBySlot.set(slot, item);
  }
  if (records.length !== 952 || queueIds.size !== expected.size || [...expected].some((id) => !queueIds.has(id))) {
    errors.push('queue must cover all 952 topic-day slots');
  }

  const draftIds = new Set();
  const draftBySlot = new Map();
  for (const [expectedDay, batch] of batches) {
    if (batch.length !== 34) errors.push('day ' + expectedDay + ' must contain exactly 34 drafts');
    for (const item of batch) {
      if (draftIds.has(item.content_id)) errors.push('duplicate draft id ' + item.content_id);
      draftIds.add(item.content_id);
      if (!topicIds.has(item.topic_id)) errors.push('unknown draft topic ' + item.topic_id);
      if (item.day_number !== expectedDay) errors.push('wrong day number for ' + item.content_id);
      if (item.content_id !== 'DRAFT_' + item.topic_id + '_D' + String(expectedDay).padStart(2, '0')) {
        errors.push('draft id does not match topic/day ' + item.content_id);
      }
      if (topicNames.has(item.topic_id) && item.topic_name !== topicNames.get(item.topic_id)) {
        errors.push('draft topic name mismatch ' + item.content_id);
      }
      const reviewedSubtopicId = REVIEWED_SUBTOPIC_MAPPINGS.get(item.content_id);
      if (reviewedSubtopicId && item.subtopic_id !== reviewedSubtopicId) {
        errors.push('reviewed subtopic mapping mismatch ' + item.content_id);
      }
      if (subById.get(item.subtopic_id)?.topic_id !== item.topic_id) {
        errors.push('subtopic parent mismatch ' + item.content_id);
      }
      for (const field of REQUIRED_DRAFT_FIELDS) {
        if (!normalizeText(item[field])) errors.push('missing ' + field + ' ' + item.content_id);
      }
      if (item.review_status !== 'draft_pending_expert_review' || item.runtime_eligible !== false) {
        errors.push('draft not blocked ' + item.content_id);
      }
      if ((item.evidence_ids ?? []).length || (item.source_reference_ids ?? []).length) {
        errors.push('unverified evidence claimed ' + item.content_id);
      }
      if (item.phase !== DAY_PHASES[expectedDay]) {
        errors.push('phase/day progression mismatch ' + item.content_id);
      }
      const slot = item.topic_id + ':' + expectedDay;
      if (draftBySlot.has(slot)) errors.push('duplicate draft topic/day slot ' + slot);
      draftBySlot.set(slot, item);
    }
  }
  if (drafts.length !== 102 || draftIds.size !== 102) {
    errors.push('day one, day two, and day three batches must contain 102 unique drafts');
  }

  for (const [day, batch] of batches) {
    for (const field of ['learning_objective', 'exercise', 'action', 'progress_measure']) {
      const values = batch.map((item) => normalizeText(item[field]));
      if (new Set(values).size !== values.length) {
        errors.push('day ' + day + ' contains duplicate ' + field + ' templates across topics');
      }
    }
  }

  for (const topicId of topicIds) {
    const topicDrafts = [1, 2, 3].map((day) => draftBySlot.get(topicId + ':' + day)).filter(Boolean);
    for (const field of PROGRESSION_FIELDS) {
      const values = topicDrafts.map((item) => normalizeText(item[field]));
      if (new Set(values).size !== values.length) {
        errors.push('topic ' + topicId + ' repeats ' + field + ' across consecutive days');
      }
    }
    const subtopicIds = topicDrafts.map((item) => item.subtopic_id);
    if (!ALLOW_REVIEWED_SUBTOPIC_REVISITS.has(topicId) &&
        new Set(subtopicIds).size !== subtopicIds.length) {
      errors.push('topic ' + topicId + ' does not progress to a distinct subtopic each day');
    }
  }

  // Guard two taxonomy/content mismatches found in the crosswalk audit.
  const dayOneByTopic = new Map((day1.records ?? []).map((item) => [item.topic_id, item]));
  const t04DayOne = dayOneByTopic.get('T04');
  if (t04DayOne?.subtopic_id === 'T04-S01') {
    const text = normalizeText([t04DayOne.learning_objective, t04DayOne.mechanism_focus, t04DayOne.exercise].join(' '));
    const explicitlyExcluded = text.includes('خودبیزاری در این رکورد بررسی نمی‌شود');
    if (!explicitlyExcluded && (text.includes('خودبیزاری') || text.includes('نفرت از خود'))) {
      errors.push('T04-S01 day-one content must not classify self-hatred under hatred toward a person/group');
    }
  }
  const t34DayOne = dayOneByTopic.get('T34');
  if (t34DayOne?.subtopic_id === 'T34-S01') {
    const text = normalizeText([t34DayOne.learning_objective, t34DayOne.mechanism_focus, t34DayOne.exercise].join(' '));
    if (text.includes('مبهم') || text.includes('خارج از صلاحیت')) {
      errors.push('T34-S01 day-one content must remain limited to a clear issue outside the 33-topic taxonomy');
    }
  }

  for (const item of drafts) {
    const queueItem = queueBySlot.get(item.topic_id + ':' + item.day_number);
    if (!queueItem || queueItem.draft_content_id !== item.content_id ||
        queueItem.source_content_id !== item.source_content_id) {
      errors.push('queue mapping mismatch ' + item.content_id);
    }
  }

  const registeredEvidenceIds = new Set((evidenceRegistry?.sources ?? []).map((item) => item.evidence_id));
  let nearDuplicateCandidateCount = 0;
  let nearDuplicateCandidates = [];
  if (Array.isArray(allDays)) {
    const completeDrafts = allDays.flatMap((batch) => batch?.records ?? []);
    if (allDays.length !== 28 || completeDrafts.length !== 952) {
      errors.push('complete draft audit must include 28 batches and 952 records');
    }
    const allDraftIds = new Set();
    const globalExercises = new Map();
    const globalActions = new Map();
    for (let day = 1; day <= 28; day++) {
      const batch = allDays[day - 1]?.records ?? [];
      if (batch.length !== 34) errors.push('complete day ' + day + ' must contain exactly 34 drafts');
      const topicDaySeen = new Set();
      const normalizedObjectives = new Map();
      const normalizedProgress = new Map();
      for (const item of batch) {
        const expectedId = 'DRAFT_' + item.topic_id + '_D' + String(day).padStart(2, '0');
        if (item.day_number !== day || item.content_id !== expectedId) {
          errors.push('complete draft topic/day id mismatch ' + item.content_id);
        }
        if (allDraftIds.has(item.content_id)) errors.push('duplicate complete draft id ' + item.content_id);
        allDraftIds.add(item.content_id);
        if (!topicIds.has(item.topic_id)) errors.push('unknown complete draft topic ' + item.topic_id);
        if (topicNames.has(item.topic_id) && item.topic_name !== topicNames.get(item.topic_id)) {
          errors.push('complete draft topic name mismatch ' + item.content_id);
        }
        if (subById.get(item.subtopic_id)?.topic_id !== item.topic_id) {
          errors.push('complete draft subtopic parent mismatch ' + item.content_id);
        }
        for (const field of REQUIRED_DRAFT_FIELDS) {
          if (!normalizeText(item[field])) errors.push('complete draft missing ' + field + ' ' + item.content_id);
        }
        if (item.review_status !== 'draft_pending_expert_review' || item.runtime_eligible !== false) {
          errors.push('complete draft not blocked ' + item.content_id);
        }
        if ((item.evidence_ids ?? []).length || (item.source_reference_ids ?? []).length) {
          errors.push('complete draft claims unverified evidence ' + item.content_id);
        }
        for (const candidateId of item.candidate_evidence_ids ?? []) {
          if (!registeredEvidenceIds.has(candidateId)) {
            errors.push('unknown candidate evidence reference ' + candidateId + ' in ' + item.content_id);
          }
        }
        const slot = item.topic_id + ':' + day;
        if (topicDaySeen.has(slot)) errors.push('duplicate complete draft slot ' + slot);
        topicDaySeen.add(slot);
        const queueItem = queueBySlot.get(slot);
        if (!queueItem || queueItem.draft_content_id !== item.content_id ||
            queueItem.source_content_id !== item.source_content_id) {
          errors.push('complete queue mapping mismatch ' + item.content_id);
        }
        const topicName = topicNames.get(item.topic_id) ?? item.topic_name ?? '';
        const normalizeTopicCopy = (value) => normalizeText(value)
          .replaceAll(topicName, '<topic>')
          .replace(/«[^»]+»/g, '«topic»');
        for (const [field, map] of [
          ['learning_objective', normalizedObjectives],
          ['progress_measure', normalizedProgress],
        ]) {
          const value = normalizeTopicCopy(item[field]);
          if (!map.has(value)) map.set(value, []);
          map.get(value).push(item.content_id);
        }
        for (const [field, map] of [['exercise', globalExercises], ['action', globalActions]]) {
          const value = normalizeText(item[field]);
          if (!map.has(value)) map.set(value, []);
          map.get(value).push(item.content_id);
        }
      }
      for (const [field, map] of [
        ['learning_objective', normalizedObjectives],
        ['progress_measure', normalizedProgress],
      ]) {
        for (const [value, ids] of map) {
          if (value && ids.length > 1) {
            errors.push('day ' + day + ' contains normalized duplicate ' + field + ' across topics: ' + ids.join(', '));
          }
        }
      }
    }
    for (const [field, map] of [['exercise', globalExercises], ['action', globalActions]]) {
      for (const [value, ids] of map) {
        if (value && ids.length > 1) {
          errors.push('global duplicate ' + field + ' across 952 drafts: ' + ids.join(', '));
        }
      }
    }
    if (allDraftIds.size !== 952) errors.push('complete draft ids must be 952 unique records');

    const stopWords = new Set([
      'و', 'در', 'از', 'به', 'را', 'برای', 'با', 'یک', 'اگر', 'که', 'این', 'آن',
      'هم', 'یا', 'تا', 'فقط', 'خود', 'می', 'شود', 'است', 'باشد', 'کن', 'کنید',
      'کنند', 'هر', 'پس', 'اما', 'همان', 'چون', 'باید', 'نمی', 'روی', 'پس',
      'هنگام', 'بعد', 'قبل', 'بدون', 'بین', 'درباره', 'چگونه', 'چه',
    ]);
    const tokenize = (value) => new Set(
      normalizeText(value)
        .replace(/[\u064B-\u065F\u0670]/g, '')
        .replace(/\u200c/g, ' ')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter((token) => token.length > 2 && !stopWords.has(token))
    );
    for (const field of ['exercise', 'action']) {
      const candidates = completeDrafts.map((item) => ({
        id: item.content_id,
        topic_id: item.topic_id,
        day_number: item.day_number,
        tokens: tokenize(item[field]),
      }));
      for (let left = 0; left < candidates.length; left += 1) {
        const a = candidates[left];
        if (a.tokens.size < 5) continue;
        for (let right = left + 1; right < candidates.length; right += 1) {
          const b = candidates[right];
          if (b.tokens.size < 5) continue;
          let shared = [];
          for (const token of a.tokens) if (b.tokens.has(token)) shared.push(token);
          if (shared.length < 5) continue;
          const score = shared.length / (a.tokens.size + b.tokens.size - shared.length);
          if (score >= 0.42) {
            nearDuplicateCandidateCount += 1;
            nearDuplicateCandidates.push({
              field,
              left: a.id,
              right: b.id,
              similarity: Number(score.toFixed(3)),
              shared_terms: shared.slice(0, 12),
            });
          }
        }
      }
    }
    nearDuplicateCandidates.sort((a, b) => b.similarity - a.similarity);
    nearDuplicateCandidates = nearDuplicateCandidates.slice(0, 100);
  }

  return {
    valid: errors.length === 0,
    errors,
    summary: {
      queue_records: records.length,
      drafts_created: Array.isArray(allDays) ? allDays.flatMap((batch) => batch?.records ?? []).length : drafts.length,
      complete_day_batches: Array.isArray(allDays) ? allDays.length : 3,
      not_started: records.filter((item) => item.redesign_status === 'not_started').length,
      runtime_eligible: drafts.filter((item) => item.runtime_eligible === true).length,
      near_duplicate_candidate_count: nearDuplicateCandidateCount,
      near_duplicate_candidates: nearDuplicateCandidates,
    },
  };
}

if (process.argv[1]?.endsWith('validate-content-redesign.mjs')) {
  const root = process.cwd();
  const read = (path) => JSON.parse(fs.readFileSync(root + '/' + path, 'utf8'));
  const result = validateContentRedesign({
    queue: read('public/assistant/content-drafts/952-day-redesign-queue.v1.json'),
    day1: read('public/assistant/content-drafts/day01-34-topic-drafts.v1.json'),
    day2: read('public/assistant/content-drafts/day02-34-topic-drafts.v1.json'),
    day3: read('public/assistant/content-drafts/day03-34-topic-drafts.v1.json'),
    allDays: Array.from({ length: 28 }, (_, index) => read('public/assistant/content-drafts/day' + String(index + 1).padStart(2, '0') + '-34-topic-drafts.v1.json')),
    topics: read('public/assistant/knowledge/topics.v1.json'),
    subtopics: read('public/assistant/knowledge/subtopics.v1.json'),
    evidenceRegistry: read('public/assistant/evidence/evidence-source-registry.v1.json'),
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.valid) throw new Error('Content redesign validation failed');
}
