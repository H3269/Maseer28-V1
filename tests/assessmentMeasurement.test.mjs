import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const journeyScreens = await readFile(
  new URL('../src/features/journey/JourneyScreens.jsx', import.meta.url),
  'utf8'
);

test('baseline and final assessment reuse the exact same first four questions', () => {
  assert.match(
    journeyScreens,
    /export const FINAL_SCALE_QUESTIONS = \[\s*\.\.\.SCALE_QUESTIONS\.slice\(0, 4\)/
  );
  assert.match(
    journeyScreens,
    /burden = complete \? burdenScoreFromAnswers\(values\.slice\(0, 4\)\.map\(Number\)\)/
  );
});

test('assessment screens disclose that custom scores are self-report, not validated clinical measures', () => {
  assert.match(journeyScreens, /خودگزارش‌دهی اختصاصی برای ثبت وضعیت امروزت/);
  assert.match(journeyScreens, /ابزار تشخیص یا مقیاس روان‌سنجی اعتبارسنجی‌شده نیستند/);
  assert.match(journeyScreens, /تغییر امتیاز به‌تنهایی اثربخشی برنامه را ثابت نمی‌کند/);
  assert.match(journeyScreens, /امتیازهای شروع و پایان بر پایه چهار پرسش اختصاصی برنامه و پاسخ‌های خودگزارشی هستند/);
  assert.match(journeyScreens, /تغییر نمره به‌تنهایی اثربخشی برنامه، علت تغییر یا سطح خطر را تعیین نمی‌کند/);
  assert.doesNotMatch(journeyScreens, /بهبود در شدت مشکل ثبت شده است/);
});

test('recommendation logic does not compare different motivation and progress constructs', () => {
  assert.doesNotMatch(journeyScreens, /motivationAttainment/);
  assert.doesNotMatch(journeyScreens, /finalProgress\s*-\s*initialMotivation/);
  assert.match(journeyScreens, /این تغییر به‌تنهایی علت تغییر یا اثربخشی برنامه را نشان نمی‌دهد/);
  assert.match(journeyScreens, /ابزار تشخیص یا توصیه درمانی قطعی نیست/);
});
