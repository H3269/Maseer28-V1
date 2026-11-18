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

function isValidKnowledgeItem(item) {
  const validTopics = Array.isArray(item?.topic_ids) && new Set(item.topic_ids).size === item.topic_ids.length;
  const validExerciseSafety = item?.content_type !== 'exercise' || Boolean(
    item.safety
    && ['routine', 'caution'].includes(item.safety.level)
    && Array.isArray(item.safety.stop_conditions)
    && item.safety.stop_conditions.length > 0
  );
  return Boolean(
    item
    && item.schema_version === '1.0.0'
    && typeof item.item_id === 'string' && item.item_id.trim() && item.item_id.length <= 120
    && typeof item.title === 'string' && item.title.trim() && item.title.length <= 240
    && typeof item.content === 'string' && item.content.trim() && item.content.length <= 12000
    && validTopics && item.topic_ids.length > 0 && item.topic_ids.length <= 5
    && item.topic_ids.every((id) => KNOWN_TOPIC.test(id))
    && ['education', 'self_reflection', 'exercise', 'safety_information'].includes(item.content_type)
    && item.source
    && typeof item.source.source_id === 'string' && item.source.source_id.trim() && item.source.source_id.length <= 120
    && typeof item.source.title === 'string' && item.source.title.trim() && item.source.title.length <= 240
    && typeof item.source.locator === 'string' && item.source.locator.trim() && item.source.locator.length <= 500
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

/** Local lexical retrieval of source-linked knowledge with independent safety checks. */
export function retrieveKnowledge({ query, topicIds = [], items = [], limit = 3 } = {}) {
  const queryTerms = tokenize(query);
  const rawTopics = Array.isArray(topicIds) ? topicIds : [];
  if (rawTopics.some((id) => typeof id !== 'string' || !KNOWN_TOPIC.test(id))) {
    return deepFreeze({ status: 'invalid_topic_filter', results: [], matched_query_terms: [] });
  }
  const requestedTopics = [...new Set(rawTopics)];
  const cappedLimit = Math.max(1, Math.min(MAX_RESULTS, Number.isInteger(limit) ? limit : 3));
  const itemIds = Array.isArray(items) ? items.map((item) => item?.item_id).filter((id) => typeof id === 'string') : [];
  if (new Set(itemIds).size !== itemIds.length) {
    return deepFreeze({ status: 'invalid_catalog', results: [], matched_query_terms: queryTerms });
  }
  const availableItems = Array.isArray(items) ? items.filter(isValidKnowledgeItem) : [];
  if (availableItems.length === 0) {
    return deepFreeze({ status: 'knowledge_unavailable', results: [], matched_query_terms: queryTerms });
  }
  if (queryTerms.length === 0) {
    return deepFreeze({ status: 'insufficient_query', results: [], matched_query_terms: [] });
  }

  const ranked = availableItems
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
    })),
  });
}
