import { env, pipeline } from '@huggingface/transformers';

const MODEL_ID = 'onnx-community/Qwen3-0.6B-Instruct-ONNX';
const MODEL_REVISION = '54250909aca286a05b9d013c8af7a21859ee6ead';
const MODEL_BYTES_REQUIRED = 700 * 1024 * 1024;
const BASE_URL = import.meta.env.BASE_URL;
const runtimeUrl = new URL(`${BASE_URL}ort/`, self.location.origin);
const nativeFetch = globalThis.fetch.bind(globalThis);
let generator = null;
let loaded = false;
let activeRequestId = null;

function sendProgress(id, detail = {}) { self.postMessage({ id, type: 'progress', ...detail }); }

function createRestrictedFetch(allowModelDownload) {
  return async (input, init = {}) => {
    const rawUrl = input instanceof Request ? input.url : String(input);
    const url = new URL(rawUrl, self.location.href);
    const method = String(init.method || input?.method || 'GET').toUpperCase();
    const hasBody = Boolean(init.body || input?.body);
    const localRuntime = url.origin === self.location.origin && url.pathname.startsWith(runtimeUrl.pathname);
    const pinnedModelFile = allowModelDownload && url.origin === 'https://huggingface.co'
      && url.pathname.startsWith(`/${MODEL_ID}/resolve/${MODEL_REVISION}/`) && method === 'GET' && !hasBody;
    if (localRuntime && method === 'GET' && !hasBody) return nativeFetch(input, init);
    if (pinnedModelFile) return nativeFetch(input, init);
    throw new Error('LOCAL_MODEL_NETWORK_POLICY_BLOCKED');
  };
}

async function configureRuntime(allowModelDownload) {
  if (!('caches' in self)) {
    const error = new Error('Browser Cache Storage is unavailable.');
    error.code = 'CACHE_UNAVAILABLE';
    throw error;
  }
  env.useBrowserCache = true;
  env.useWasmCache = true;
  env.cacheKey = 'maseer28-local-qwen3-06b-v1';
  env.remoteHost = 'https://huggingface.co/';
  env.remotePathTemplate = '{model}/resolve/{revision}/';
  env.allowLocalModels = false;
  env.allowRemoteModels = allowModelDownload;
  env.fetch = createRestrictedFetch(allowModelDownload);
  env.backends.onnx.wasm.wasmPaths = runtimeUrl.href;
  env.backends.onnx.wasm.numThreads = 1;
  env.backends.onnx.wasm.proxy = false;
}

async function loadModel(allowDownload, requestId) {
  if (loaded && generator) return;
  if (allowDownload && self.navigator?.onLine === false) {
    const error = new Error('برای بارگیری اولیه مدل، اتصال اینترنت لازم است.');
    error.code = 'MODEL_DOWNLOAD_OFFLINE';
    throw error;
  }
  if (allowDownload && self.navigator?.storage?.estimate) {
    const estimate = await self.navigator.storage.estimate();
    const remaining = Number(estimate.quota || 0) - Number(estimate.usage || 0);
    if (estimate.quota && remaining > 0 && remaining < MODEL_BYTES_REQUIRED) {
      const error = new Error('فضای ذخیره‌سازی آزاد مرورگر برای مدل حدود ۶۵۰ مگابایتی کافی نیست.');
      error.code = 'STORAGE_QUOTA_LOW';
      throw error;
    }
  }
  await configureRuntime(allowDownload);
  try {
    generator = await pipeline('text-generation', MODEL_ID, {
      revision: MODEL_REVISION,
      dtype: 'q4f16',
      device: 'wasm',
      progress_callback: (progress) => sendProgress(requestId, {
        stage: 'model', status: progress?.status || 'loading', file: progress?.file || '',
        progress: Number.isFinite(progress?.progress) ? progress.progress : null,
        loadedBytes: Number.isFinite(progress?.loaded) ? progress.loaded : null,
        totalBytes: Number.isFinite(progress?.total) ? progress.total : null,
      }),
    });
    loaded = true;
    env.allowRemoteModels = false;
    env.fetch = createRestrictedFetch(false);
  } catch (cause) {
    generator = null;
    loaded = false;
    const error = new Error(cause?.message || 'Local model loading failed.');
    error.code = allowDownload ? 'MODEL_LOAD_FAILED' : 'MODEL_NOT_INSTALLED';
    throw error;
  }
}

function getGeneratedText(output) {
  const generated = output?.[0]?.generated_text;
  let text = '';
  if (Array.isArray(generated)) {
    const assistant = [...generated].reverse().find((message) => message?.role === 'assistant');
    text = assistant?.content || '';
  } else if (typeof generated === 'string') text = generated;
  return String(text).trim().replace(/^<think>[\s\S]*?<\/think>/iu, '').replace(/<\/?think>/giu, '').trim();
}

async function generate(messages, requestId) {
  if (!loaded || !generator) {
    const error = new Error('The local model has not been loaded.');
    error.code = 'MODEL_NOT_INSTALLED';
    throw error;
  }
  sendProgress(requestId, { stage: 'generation', status: 'generating' });
  const output = await generator(messages, {
    max_new_tokens: 180,
    do_sample: false,
    repetition_penalty: 1.08,
    tokenizer_encode_kwargs: { chat_template_kwargs: { enable_thinking: false } },
  });
  const text = getGeneratedText(output);
  if (!text) {
    const error = new Error('The local model returned an empty answer.');
    error.code = 'EMPTY_MODEL_RESPONSE';
    throw error;
  }
  return text.slice(0, 12000);
}

self.addEventListener('message', async (event) => {
  const data = event.data || {};
  const { id, action } = data;
  if (!Number.isInteger(id) || activeRequestId !== null) {
    self.postMessage({ id, type: 'error', code: 'WORKER_BUSY', message: 'Local model worker is busy.' });
    return;
  }
  activeRequestId = id;
  try {
    if (action === 'load') {
      await loadModel(data.allowDownload === true, id);
      self.postMessage({ id, type: 'result', result: { loaded: true, modelId: MODEL_ID, revision: MODEL_REVISION } });
    } else if (action === 'generate') {
      const text = await generate(Array.isArray(data.messages) ? data.messages : [], id);
      self.postMessage({ id, type: 'result', result: { text, local: true } });
    } else {
      const error = new Error('Unknown local model action.');
      error.code = 'UNKNOWN_ACTION';
      throw error;
    }
  } catch (error) {
    self.postMessage({ id, type: 'error', code: error?.code || 'LOCAL_MODEL_ERROR', message: String(error?.message || 'Local model error.').slice(0, 500) });
  } finally {
    activeRequestId = null;
  }
});
