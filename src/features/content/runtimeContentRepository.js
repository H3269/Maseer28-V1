import { mergeDailyTextOverrides } from './dailyTextOverrides.js';

const EXPECTED_TOPIC_COUNT = 34;
const EXPECTED_DAYS_PER_TOPIC = 28;

function joinBaseUrl(baseUrl, relativePath) {
  const base = String(baseUrl || '/').endsWith('/') ? String(baseUrl || '/') : `${baseUrl}/`;
  return `${base}content/runtime-v1/${relativePath}`;
}

function assertTopicCategory(category, topicKey) {
  if (!category || !Array.isArray(category.days) || category.days.length !== EXPECTED_DAYS_PER_TOPIC) {
    throw new Error(`محتوای موضوع «${topicKey}» ناقص است.`);
  }
  const ids = new Set();
  category.days.forEach((day, index) => {
    if (Number(day?.day) !== index + 1 || typeof day?.id !== 'string' || !day.id.trim() || ids.has(day.id)) {
      throw new Error(`ترتیب یا شناسه روزهای موضوع «${topicKey}» معتبر نیست.`);
    }
    ids.add(day.id);
  });
}

function validateIndex(index) {
  if (!index || index.schema_version !== '1.0.0' || !Array.isArray(index.topics)
    || index.topics.length !== EXPECTED_TOPIC_COUNT) {
    throw new Error('فهرست محتوای برنامه معتبر نیست.');
  }
  const keys = new Set();
  const ids = new Set();
  for (const topic of index.topics) {
    if (!topic || typeof topic.key !== 'string' || !topic.key.trim()
      || typeof topic.topic_id !== 'string' || !/^T\\d{2}$/.test(topic.topic_id)
      || !/^topics\\/T\\d{2}\\.json$/.test(topic.basePath)
      || !/^overrides\\/T\\d{2}\\.json$/.test(topic.overridePath)
      || keys.has(topic.key) || ids.has(topic.topic_id)) {
      throw new Error('نگاشت موضوع‌ها در فهرست محتوای برنامه معتبر نیست.');
    }
    keys.add(topic.key);
    ids.add(topic.topic_id);
  }
  return index;
}

export function createRuntimeContentRepository({
  baseUrl = '/',
  fetchImpl = globalThis.fetch,
  retries = 2,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('تابع دریافت فایل در دسترس نیست.');
  const topicPromises = new Map();
  let indexPromise = null;

  async function fetchJson(relativePath) {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const response = await fetchImpl(joinBaseUrl(baseUrl, relativePath), {
          cache: attempt === 0 ? 'default' : 'reload',
          priority: relativePath === 'index.json' ? 'high' : 'low',
        });
        if (!response?.ok) {
          const status = Number(response?.status || 0);
          if (status >= 500 && attempt < retries) continue;
          const error = new Error(`دریافت محتوای برنامه ناموفق بود (کد ${status}).`);
          error.permanent = status > 0 && status < 500;
          throw error;
        }
        return await response.json();
      } catch (error) {
        lastError = error;
        if (error instanceof SyntaxError || error?.permanent || attempt >= retries) break;
      }
    }
    throw lastError || new Error('دریافت محتوای برنامه ناموفق بود.');
  }

  function loadContentIndex() {
    if (!indexPromise) {
      indexPromise = fetchJson('index.json').then(validateIndex).catch((error) => {
        indexPromise = null;
        throw error;
      });
    }
    return indexPromise;
  }

  function loadTopicContent(topicKey) {
    if (typeof topicKey !== 'string' || !topicKey.trim()) {
      return Promise.reject(new Error('موضوع مسیر مشخص نیست.'));
    }
    if (topicPromises.has(topicKey)) return topicPromises.get(topicKey);

    const request = loadContentIndex().then(async (index) => {
      const topic = index.topics.find((item) => item.key === topicKey);
      if (!topic) throw new Error('محتوای موضوع انتخاب‌شده در فهرست موجود نیست.');
      const [baseCategory, overlayCategory] = await Promise.all([
        fetchJson(topic.basePath),
        fetchJson(topic.overridePath),
      ]);
      const merged = mergeDailyTextOverrides(
        { categories: { [topic.key]: baseCategory } },
        { categories: { [topic.key]: overlayCategory } },
      );
      const category = merged?.categories?.[topic.key];
      assertTopicCategory(category, topic.key);
      return category;
    }).catch((error) => {
      topicPromises.delete(topicKey);
      throw error;
    });
    topicPromises.set(topicKey, request);
    return request;
  }

  async function loadTopicsContent(topicKeys) {
    const uniqueKeys = [...new Set((Array.isArray(topicKeys) ? topicKeys : []).filter((key) => typeof key === 'string' && key.trim()))];
    const categories = {};
    await Promise.all(uniqueKeys.map(async (key) => {
      categories[key] = await loadTopicContent(key);
    }));
    return { categories };
  }

  return Object.freeze({ loadContentIndex, loadTopicContent, loadTopicsContent });
}
