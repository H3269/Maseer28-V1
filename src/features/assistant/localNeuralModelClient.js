// The conversational neural model is intentionally disabled for every app screen.
// Keep these exports as fail-closed compatibility stubs for any stale caller.
function disabledError() {
  const error = new Error('مدل مکالمه‌ای دستیار در این نسخه غیرفعال است.');
  error.code = 'LOCAL_MODEL_DISABLED';
  return error;
}

export async function isLocalNeuralModelInstalled() {
  return false;
}

export async function requestLocalNeuralModel() {
  throw disabledError();
}
