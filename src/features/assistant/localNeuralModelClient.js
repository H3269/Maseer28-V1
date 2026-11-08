import { LOCAL_MODEL_ID, LOCAL_MODEL_REVISION, LOCAL_MODEL_MARKER_CACHE, isLocalModelCacheMarkerValid } from './localNeuralAssistant.js';

let workerInstance = null;
let nextRequestId = 0;
const pendingRequests = new Map();
let localModelCacheStatus = 'unknown';

function rejectPending(error) {
  for (const pending of pendingRequests.values()) pending.reject(error);
  pendingRequests.clear();
}

async function checkInstalledModelMarker() {
  if (!('caches' in globalThis) || !globalThis.location?.origin) {
    const error = new Error('Browser Cache Storage is unavailable.');
    error.code = 'CACHE_UNAVAILABLE';
    throw error;
  }
  const cache = await caches.open(LOCAL_MODEL_MARKER_CACHE);
  const markerUrl = new URL(`${import.meta.env.BASE_URL}local-model/qwen3-0.6b-ready.json`, globalThis.location.origin);
  const response = await cache.match(markerUrl.href);
  if (!response) return false;
  try { return isLocalModelCacheMarkerValid(await response.json()); } catch { return false; }
}

// The Library UI uses this read-only check to choose between guided prompts and
// free-form input. A marker is written only after a successful local model load.
export async function isLocalNeuralModelInstalled() {
  try {
    const installed = await checkInstalledModelMarker();
    localModelCacheStatus = installed ? 'ready' : 'missing';
    return installed;
  } catch {
    return false;
  }
}

function getWorker() {
  if (workerInstance) return workerInstance;
  if (typeof Worker === 'undefined') {
    const error = new Error('Web Workers are unavailable in this browser.');
    error.code = 'WORKER_UNAVAILABLE';
    throw error;
  }
  workerInstance = new Worker(new URL('./localNeuralModel.worker.js', import.meta.url), { type: 'module' });
  workerInstance.addEventListener('message', (event) => {
    const data = event.data || {};
    const pending = pendingRequests.get(data.id);
    if (!pending) return;
    if (data.type === 'progress') {
      try { pending.onProgress?.(data); } catch { /* progress UI must not interrupt inference */ }
      return;
    }
    pendingRequests.delete(data.id);
    if (data.type === 'result') {
      if (pending.action === 'load') localModelCacheStatus = 'ready';
      pending.resolve(data.result);
    } else {
      const error = new Error(data.message || 'Local model operation failed.');
      error.code = data.code || 'LOCAL_MODEL_ERROR';
      if (pending.action === 'load' && pending.allowDownload !== true && error.code === 'MODEL_NOT_INSTALLED') localModelCacheStatus = 'missing';
      pending.reject(error);
    }
  });
  workerInstance.addEventListener('error', (event) => {
    const error = new Error(event.message || 'Local model worker crashed.');
    error.code = 'WORKER_CRASH';
    rejectPending(error);
    workerInstance?.terminate();
    workerInstance = null;
    localModelCacheStatus = 'unknown';
  });
  return workerInstance;
}

export async function requestLocalNeuralModel(action, payload = {}, onProgress) {
  if (action === 'load' && payload.allowDownload !== true && localModelCacheStatus === 'unknown') {
    try {
      localModelCacheStatus = (await checkInstalledModelMarker()) ? 'ready' : 'missing';
    } catch (error) {
      throw error;
    }
  }
  if (action === 'load' && payload.allowDownload !== true && localModelCacheStatus === 'missing') {
    const error = new Error('The local model is not installed in this browser cache.');
    error.code = 'MODEL_NOT_INSTALLED';
    throw error;
  }
  return new Promise((resolve, reject) => {
    let worker;
    try { worker = getWorker(); } catch (error) { reject(error); return; }
    const id = ++nextRequestId;
    pendingRequests.set(id, { resolve, reject, onProgress, action, allowDownload: payload.allowDownload === true });
    try { worker.postMessage({ id, action, ...payload }); }
    catch (error) { pendingRequests.delete(id); reject(error); }
  });
}
