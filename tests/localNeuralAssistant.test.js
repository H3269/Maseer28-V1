import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LOCAL_MODEL_ID, LOCAL_MODEL_REVISION, LOCAL_MODEL_INSTALL_COMMAND, LOCAL_MODEL_INSTALL_MESSAGE, LOCAL_MODEL_MARKER_CACHE, isLocalModelCacheMarkerValid,
  appendLocalSourceReferences, buildLocalAssistantMessages, extractLocalSourceReferences,
  isLocalModelInstallCommand, isAllowedLocalModelFetch, shouldUseLocalNeuralModel,
} from '../src/features/assistant/localNeuralAssistant.js';

test('model identity is pinned to an immutable revision', () => {
  assert.equal(LOCAL_MODEL_ID, 'onnx-community/Qwen3-0.6B-Instruct-ONNX');
  assert.match(LOCAL_MODEL_REVISION, /^[a-f0-9]{40}$/);
});
test('install command is explicit and normalized', () => {
  assert.equal(isLocalModelInstallCommand(LOCAL_MODEL_INSTALL_COMMAND), true);
  assert.equal(isLocalModelInstallCommand('نصب مدل محلی'), true);
  assert.equal(isLocalModelInstallCommand('لطفاً مدل محلی را توضیح بده'), false);
});
test('daily and safety-gated turns never enter neural generation', () => {
  const turn = { status: 'page_guidance_available', message: 'راهنمای صفحه' };
  assert.equal(shouldUseLocalNeuralModel({ screen: 'day', turn }), false);
  assert.equal(shouldUseLocalNeuralModel({ screen: 'dashboard', turn, intentStatus: 'urgent_human_support_required' }), false);
  assert.equal(shouldUseLocalNeuralModel({ screen: 'dashboard', turn, intentStatus: 'personal_intake_required' }), false);
  assert.equal(shouldUseLocalNeuralModel({ screen: 'dashboard', turn: { ...turn, status: 'clarification_required' } }), false);
});
test('only approved page guidance and approved knowledge are eligible', () => {
  assert.equal(shouldUseLocalNeuralModel({ screen: 'dashboard', turn: { status: 'page_guidance_available', message: 'راهنما' } }), true);
  assert.equal(shouldUseLocalNeuralModel({ screen: 'dashboard', turn: { status: 'approved_knowledge_available', message: 'منبع' } }), true);
  assert.equal(shouldUseLocalNeuralModel({ screen: 'dashboard', turn: { status: 'knowledge_unavailable', message: 'بدون شاهد' } }), false);
});
test('book generation requires retrieved source evidence and respects personal-intake gate', () => {
  assert.equal(shouldUseLocalNeuralModel({ screen: 'books', isLibraryTurn: true, intentStatus: 'knowledge_unavailable', turn: { message: 'گزیده\nمنبع: فصل اول · صفحه ۱۲' } }), true);
  assert.equal(shouldUseLocalNeuralModel({ screen: 'books', isLibraryTurn: true, intentStatus: 'personal_intake_required', turn: { message: 'منبع: صفحه ۱۲' } }), false);
  assert.equal(shouldUseLocalNeuralModel({ screen: 'books', isLibraryTurn: true, turn: { message: 'پاسخ بدون منبع' } }), false);
});
test('model input contains only the current question and supplied local evidence', () => {
  const messages = buildLocalAssistantMessages({
    question: 'این مفهوم را ساده توضیح بده',
    context: 'گزیده کتاب\nمنبع: فصل دوم · صفحه ۲۱',
    knowledge: [{ title: 'منبع تأییدشده', excerpt: 'شاهد متنی', source: { title: 'کتاب', locator: 'صفحه ۲۱' } }],
  });
  assert.equal(messages.length, 2);
  assert.equal(messages[0].role, 'system');
  assert.equal(messages[1].role, 'user');
  assert.match(messages[0].content, /به فارسی/u);
  assert.match(messages[0].content, /تشخیص پزشکی/u);
  assert.match(messages[1].content, /این مفهوم را ساده توضیح بده/u);
  assert.match(messages[1].content, /شاهد متنی/u);
  assert.match(messages[1].content, /صفحه ۲۱/u);
});
test('source references are preserved exactly and deduplicated', () => {
  const context = 'پاسخ\nمنبع: فصل اول · صفحه ۱۲\nمنبع: فصل اول · صفحه ۱۲\nصفحه ۱۴';
  assert.deepEqual(extractLocalSourceReferences(context), ['منبع: فصل اول · صفحه ۱۲', 'صفحه ۱۴']);
  assert.match(appendLocalSourceReferences('توضیح خلاصه', context), /صفحه ۱۴/u);
});
test('first-use disclosure states download size and local-only inference', () => {
  assert.match(LOCAL_MODEL_INSTALL_MESSAGE, /۶۵۰/u);
  assert.match(LOCAL_MODEL_INSTALL_MESSAGE, /۷۵۰/u);
  assert.match(LOCAL_MODEL_INSTALL_MESSAGE, /هیچ پرسش/u);
  assert.match(LOCAL_MODEL_INSTALL_MESSAGE, /بدون اینترنت/u);
});

test('worker network allowlist blocks prompts and all non-model remote endpoints', () => {
  const base = {
    appOrigin: 'https://h3269.github.io',
    runtimePath: '/Maseer28-V1/ort/',
    method: 'GET',
    hasBody: false,
  };
  assert.equal(isAllowedLocalModelFetch({ ...base, requestUrl: 'https://h3269.github.io/Maseer28-V1/ort/ort-wasm-simd-threaded.wasm' }), true);
  const modelFile = `https://huggingface.co/${LOCAL_MODEL_ID}/resolve/${LOCAL_MODEL_REVISION}/onnx/model_q4f16.onnx`;
  assert.equal(isAllowedLocalModelFetch({ ...base, requestUrl: modelFile, allowModelDownload: true }), true);
  assert.equal(isAllowedLocalModelFetch({ ...base, requestUrl: modelFile, allowModelDownload: false }), false);
  assert.equal(isAllowedLocalModelFetch({ ...base, requestUrl: 'https://api.openai.com/v1/chat/completions', allowModelDownload: true }), false);
  assert.equal(isAllowedLocalModelFetch({ ...base, requestUrl: modelFile.replace(LOCAL_MODEL_REVISION, 'main'), allowModelDownload: true }), false);
  assert.equal(isAllowedLocalModelFetch({ ...base, requestUrl: modelFile, allowModelDownload: true, method: 'POST' }), false);
  assert.equal(isAllowedLocalModelFetch({ ...base, requestUrl: modelFile, allowModelDownload: true, hasBody: true }), false);
});

test('the installed-model marker is version-bound and never accepts a different model revision', () => {
  assert.equal(LOCAL_MODEL_MARKER_CACHE, 'maseer28-local-model-state-v1');
  assert.equal(isLocalModelCacheMarkerValid({ modelId: LOCAL_MODEL_ID, revision: LOCAL_MODEL_REVISION }), true);
  assert.equal(isLocalModelCacheMarkerValid({ modelId: LOCAL_MODEL_ID, revision: LOCAL_MODEL_REVISION, device: 'wasm', dtype: 'q8' }, { device: 'wasm', dtype: 'q8' }), true);
  assert.equal(isLocalModelCacheMarkerValid({ modelId: LOCAL_MODEL_ID, revision: LOCAL_MODEL_REVISION, device: 'webgpu', dtype: 'q4f16' }, { device: 'wasm', dtype: 'q8' }), false);
  assert.equal(isLocalModelCacheMarkerValid({ modelId: LOCAL_MODEL_ID, revision: 'main' }), false);
  assert.equal(isLocalModelCacheMarkerValid({ modelId: 'other/model', revision: LOCAL_MODEL_REVISION }), false);
  assert.equal(isLocalModelCacheMarkerValid(null), false);
});
