const KNOWN_TOPIC = /^T(0[1-9]|[12][0-9]|3[0-4])$/;
const MAX_RESULTS = 5;
const STOP_WORDS = new Set(['چیست', 'چه', 'چگونه', 'درباره', 'در', 'از', 'به', 'برای', 'من', 'تو', 'این', 'آن', 'یک', 'و', 'یا', 'را', 'می', 'شود', 'است', 'هست', 'دارم', 'دارید', 'آیا', 'کنم', 'کنید', 'وجود', 'دارد', 'راهکاری']);

function normalize(value) {
  return String(value ?? '').normalize('NFKC')
    .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[\u200c\u200f\u200e]/g, ' ')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}

function tokenize(value) {
  return [...new Set(normalize(value)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token)))];
}

function isApprovedItem(item) {
  const allowedReviewers = {
    education: ['qualified_clinician', 'evidence_reviewer'],
    self_reflection: ['qualified_clinician', 'evidence_reviewer'],
    exercise: ['qualified_clinician'],
    safety_information: ['qualified_clinician', 'safety_reviewer'],
  };
  const validTopics = Array.isArray(item?.topic_ids) && new Set(item.topic_ids).size === item.topic_ids.length;
  const validExerciseSafety = item?.content_type !== 'exercise' || Boolean(item.safety && ['routine', 'caution'].includes(item.safety.level) && Array.isArray(item.safety.stop_conditions) && item.safety.stop_conditions.length > 0);
  return Boolean(
    item
    && item.schema_version === '1.0.0'
    && typeof item.item_id === 'string'
    && item.item_id.trim().length > 0
    && item.item_id.length <= 120
    && typeof item.title === 'string'
    && item.title.trim().length > 0
    && item.title.length <= 240
    && typeof item.content === 'string'
    && item.content.trim().length > 0
    && item.content.length <= 12000
    && validTopics
    && item.topic_ids.length > 0
    && item.topic_ids.length <= 5
    && item.topic_ids.every((id) => KNOWN_TOPIC.test(id))
    && ['education', 'self_reflection', 'exercise', 'safety_information'].includes(item.content_type)
    && item.source
    && typeof item.source.source_id === 'string'
    && item.source.source_id.trim().length > 0
    && item.source.source_id.length <= 120
    && typeof item.source.title === 'string'
    && item.source.title.trim().length > 0
    && item.source.title.length <= 240
    && typeof item.source.locator === 'string'
    && item.source.locator.trim().length > 0
    && item.source.locator.length <= 500
    && item.approval?.status === 'approved_for_assistant'
    && allowedReviewers[item.content_type]?.includes(item.approval.reviewer_role)
    && typeof item.approval.reviewed_at === 'string'
    && !Number.isNaN(Date.parse(item.approval.reviewed_at))
    && typeof item.approval.review_record_id === 'string'
    && item.approval.review_record_id.trim().length > 0
    && item.approval.review_record_id.length <= 120
    && typeof item.approval.version === 'string'
    && item.approval.version.trim()
    && validExerciseSafety
    && item.safety?.level !== 'human_review_required'
  );
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

/**
 * Lexical retrieval only. This function never generates, paraphrases or recommends
 * interventions; it returns excerpts from items explicitly approved for assistant use.
 */
export function retrieveApprovedKnowledge({ query, topicIds = [], items = [], approvalManifest = null, limit = 3 } = {}) {
  const queryTerms = tokenize(query);
  const manifestBaseValid = approvalManifest?.schema_version === '1.0.0'
    && typeof approvalManifest.manifest_id === 'string'
    && approvalManifest.manifest_id.trim().length > 0
    && approvalManifest.manifest_id.length <= 120
    && approvalManifest.status === 'active'
    && Array.isArray(approvalManifest.approved_items)
    && approvalManifest.approved_items.length > 0;
  const manifestEntries = manifestBaseValid ? approvalManifest.approved_items : [];
  const manifestMap = new Map();
  let manifestValid = manifestBaseValid;
  for (const entry of manifestEntries) {
    const validEntry = entry
      && typeof entry.item_id === 'string'
      && entry.item_id.trim().length > 0
      && entry.item_id.length <= 120
      && typeof entry.review_record_id === 'string'
      && entry.review_record_id.trim().length > 0
      && entry.review_record_id.length <= 120
      && ['qualified_clinician', 'evidence_reviewer', 'safety_reviewer'].includes(entry.reviewer_role)
      && typeof entry.reviewed_at === 'string'
      && !Number.isNaN(Date.parse(entry.reviewed_at))
      && typeof entry.version === 'string'
      && entry.version.trim().length > 0
      && entry.version.length <= 40;
    if (!validEntry || manifestMap.has(entry.item_id)) {
      manifestValid = false;
      break;
    }
    manifestMap.set(entry.item_id, entry);
  }
  if (!manifestValid) manifestMap.clear();
  const approvedCandidates = Array.isArray(items)
    ? items.filter((item) => {
      if (!isApprovedItem(item)) return false;
      const entry = manifestMap.get(item.item_id);
      return Boolean(
        entry
        && entry.review_record_id === item.approval.review_record_id
        && entry.reviewer_role === item.approval.reviewer_role
        && entry.reviewed_at === item.approval.reviewed_at
        && entry.version === item.approval.version
      );
    })
    : [];
  const candidateIds = approvedCandidates.map((item) => item.item_id);
  const duplicateCatalogIds = new Set(candidateIds).size !== candidateIds.length;
  const safeItems = duplicateCatalogIds
    ? []
    : approvedCandidates;
  const rawTopics = Array.isArray(topicIds) ? topicIds : [];
  if (rawTopics.some((id) => typeof id !== 'string' || !KNOWN_TOPIC.test(id))) {
    return deepFreeze({ status: 'invalid_topic_filter', results: [], matched_query_terms: [] });
  }
  const requestedTopics = [...new Set(rawTopics)];
  const cappedLimit = Math.max(1, Math.min(MAX_RESULTS, Number.isInteger(limit) ? limit : 3));

  if (safeItems.length === 0) {
    return deepFreeze({ status: 'no_approved_content', results: [], matched_query_terms: queryTerms });
  }
  if (queryTerms.length === 0) {
    return deepFreeze({ status: 'insufficient_query', results: [], matched_query_terms: [] });
  }

  const ranked = safeItems
    .filter((item) => requestedTopics.length === 0 || item.topic_ids.some((id) => requestedTopics.includes(id)))
    .map((item) => {
      const searchable = tokenize([item.title, item.content].join(' '));
      const matched = queryTerms.filter((term) => searchable.includes(term));
      return { item, matched, score: matched.length };
    })
    .filter((entry) => entry.score >= (queryTerms.length > 3 ? 2 : 1))
    .sort((a, b) => b.score - a.score || a.item.item_id.localeCompare(b.item.item_id));

  if (ranked.length === 0) {
    return deepFreeze({ status: 'no_relevant_match', results: [], matched_query_terms: queryTerms });
  }

  return deepFreeze({
    status: 'results_found',
    matched_query_terms: queryTerms,
    results: ranked.slice(0, cappedLimit).map(({ item, matched }) => ({
      item_id: item.item_id,
      title: item.title,
      content_type: item.content_type,
      topic_ids: [...item.topic_ids],
      excerpt: item.content.slice(0, 1200),
      matched_terms: matched,
      source: {
        source_id: item.source.source_id,
        title: item.source.title,
        locator: item.source.locator,
      },
      safety: item.safety ? { level: item.safety.level ?? 'routine', stop_conditions: [...(item.safety.stop_conditions ?? [])] } : { level: 'routine', stop_conditions: [] },
      approval: {
        reviewer_role: item.approval.reviewer_role,
        reviewed_at: item.approval.reviewed_at,
        version: item.approval.version,
        review_record_id: item.approval.review_record_id,
      },
    })),
  });
}
