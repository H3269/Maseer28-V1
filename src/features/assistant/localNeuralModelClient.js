let workerInstance = null;
let nextRequestId = 0;
const pendingRequests = new Map();

function rejectPending(error) {
  for (const pending of pendingRequests.values()) pending.reject(error);
  pendingRequests.clear();
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
    if (data.type === 'result') pending.resolve(data.result);
    else {
      const error = new Error(data.message || 'Local model operation failed.');
      error.code = data.code || 'LOCAL_MODEL_ERROR';
      pending.reject(error);
    }
  });
  workerInstance.addEventListener('error', (event) => {
    const error = new Error(event.message || 'Local model worker crashed.');
    error.code = 'WORKER_CRASH';
    rejectPending(error);
    workerInstance?.terminate();
    workerInstance = null;
  });
  return workerInstance;
}

export function requestLocalNeuralModel(action, payload = {}, onProgress) {
  return new Promise((resolve, reject) => {
    let worker;
    try { worker = getWorker(); } catch (error) { reject(error); return; }
    const id = ++nextRequestId;
    pendingRequests.set(id, { resolve, reject, onProgress });
    try { worker.postMessage({ id, action, ...payload }); }
    catch (error) { pendingRequests.delete(id); reject(error); }
  });
}
