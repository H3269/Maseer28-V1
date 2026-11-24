import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/features/assistant/GlobalAssistantLauncher.jsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../src/styles/original-v72.css', import.meta.url), 'utf8');

test('first-use welcome is shown only before the first assistant question', () => {
  assert.match(source, /messages\.length === 0 && activePromptGroups\.some/);
  assert.ok(source.includes('درود! من دستیار راهنما هستم.'));
  assert.ok(source.includes('پاسخ و راهنمایی متناسب با همان موضوع را دریافت کنی.'));
});

test('guidance describes the actual suggested-question picker and send button', () => {
  assert.ok(source.includes('از فهرست سؤال‌های پیشنهادی انتخاب کن.'));
  assert.ok(source.includes('پس از انتخاب سؤال، دکمه ارسال را بزن.'));
  assert.ok(source.includes('انتخاب از میان سؤال‌های پیشنهادی'));
  assert.ok(source.includes('title="ارسال سؤال انتخاب‌شده"'));
});

test('pointing hands are placed in separate guidance blocks for the two controls', () => {
  assert.match(source, /assistantWelcomeStepPrompt[\s\S]*?👇[\s\S]*?assistantWelcomeStepSend[\s\S]*?👇/);
  assert.match(styles, /\.assistantWelcomeStepPrompt[\s\S]*?align-items: flex-start/);
  assert.match(styles, /\.assistantWelcomeStepSend[\s\S]*?align-items: flex-end/);
});
