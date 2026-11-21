import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanPreparedAssistantTopicText } from '../src/features/assistant/teacherStylePreparedAnswer.js';

test('prepared assistant output replaces internal topic identifiers and clinical abbreviations with Persian', () => {
  const source = 'بسته T11 و T11-A01: BFRB, ERP, OCD, HRT, ComB, CBIT, masking, PGD, PTSD, tic, stimming, S01, S02, S03 و q01';
  const visible = cleanPreparedAssistantTopicText(source, 'عادت‌های تکراری');

  assert.match(visible, /عادت‌های تکراری/u);
  assert.doesNotMatch(visible, /[A-Za-z]/u);
  assert.doesNotMatch(visible, /بسته/u);
});

test('prepared assistant normalization keeps user-facing Persian text and does not add a shared template', () => {
  const source = 'تمرین امروز را با توجه به موقعیت خودت انجام بده و شدت ناراحتی را ثبت کن.';
  assert.equal(cleanPreparedAssistantTopicText(source, 'اضطراب'), source);
});
