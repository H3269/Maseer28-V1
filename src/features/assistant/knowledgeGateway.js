const KNOWN_TOPIC = /^T(0[1-9]|[12][0-9]|3[0-4])$/;
const MAX_RESULTS = 5;

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
    .filter((token) => token.length > 1))];
}

function isApprovedItem(item) {
  return Boolean(
    item
    && item.schema_version === '1.0.0'
    && typeof item.item_id === 'string'
    && item.item_id.trim()
    && typeof item.title === 'string'
    && item.title.trim()
    && typeof item.content === 'string'
    && item.content.trim()
    && Array.isArray(item.topic_ids)
    && item.topic_ids.length > 0
    && item.topic_ids.length <= 5
    && item.topic_ids.every((id) => KNOWN_TOPIC.test(id))
    && ['education', 'self_reflection', 'exercise', 'safety_information'].includes(item.content_type)
    && item.source
    && typeof item.source.source_id === 'string'
    && item.source.source_id.trim()
    && typeof item.source.title === 'string'
    && item.source.title.trim()
    && typeof item.source.locator === 'string'
    && item.source.locator.trim()
    && item.approval?.status === 'approved_for_assistant'
    && ['qualified_clinician', 'evidence_reviewer', 'safety_reviewer', 'legal_reviewer', 'editorial_reviewer'].includes(item.approval.reviewer_role)
    && typeof item.approval.reviewed_at === 'string'
    && !Number.isNaN(Date.parse(item.approval.reviewed_at))
    && typeof item.approval.version === 'string'
    && item.approval.version.trim()
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
export function retrieveApprovedKnowledge({ query, topicIds = [], items = [], limit = 3 } = {}) {
  const queryTerms = tokenize(query);
  const safeItems = Array.isArray(items) ? items.filter(isApprovedItem) : [];
  const requestedTopics = Array.isArray(topicIds) ? topicIds.filter((id) => KNOWN_TOPIC.test(id)) : [];
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
    .filter((entry) => entry.score > 0)
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
      approval: {
        reviewer_role: item.approval.reviewer_role,
        reviewed_at: item.approval.reviewed_at,
        version: item.approval.version,
      },
    })),
  });
}
