import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getT01PausePlan } from '../src/features/journey/t01PausePlan.js';

test('T01 day 10 provides a three-part, conditional pause plan', () => {
  const plan = getT01PausePlan({ topic_id: 'T01', day: 10, id: 'T01-D10' });
  assert.match(plan, /یک برنامه مکث امن با سه جزء بنویس/);
  assert.match(plan, /نشانه مکث/);
  assert.match(plan, /محل فاصله‌گیری/);
  assert.match(plan, /شرط ادامه گفتگو/);
  assert.match(plan, /ادامه فقط با رضایت آزادانه هر دو نفر/);
  assert.match(plan, /تعیین زمان بازگشت یا وعده ادامه گفتگو الزامی نیست/);
  assert.match(plan, /اگر درباره امنیت یا رضایت آزادانه تردید داری/);
});

test('T01 days 10 and 11 retain the exact reference-app exercise and action text', async () => {
  const content = JSON.parse(await readFile(new URL('../public/content/path-content.json', import.meta.url), 'utf8'));
  const day10 = content.categories['خشم'].days.find((item) => item.day === 10);
  const day11 = content.categories['خشم'].days.find((item) => item.day === 11);
  assert.equal(day10.exercise, 'یک کاری را که به‌خاطر «خشم» دشوار شده، انتخاب کن. آن را به کوچک‌ترین گام امنی تقسیم کن که حداکثر چند دقیقه زمان می‌برد و معیار پایان آن را مشخص کن. اگر گام هنوز بزرگ است، دوباره آن را کوچک‌تر کن تا دقیقاً بدانی از کجا شروع می‌شود.');
  assert.equal(day10.actionText, 'فقط همان گام کوچک را انجام بده، نه کل کار را. پس از پایان، علامت بزن که انجام شد؛ کیفیت یا نتیجه کامل شرط موفقیت این مرحله نیست. پس از انجام گام، بنویس چه چیزی شروع را آسان‌تر کرد تا برای گام‌های بعدی استفاده کنی.');
  assert.equal(day11.exercise, 'در موقعیتی مرتبط با «خشم»، بنویس چه چیزی در اختیار توست و چه چیزی در اختیار تو نیست. یک مرز سالم یا محدودیت واقعی خود را هم مشخص کن. مرز باید با شرایط واقعی و امنیت تو سازگار باشد؛ مسئولیت رفتار دیگران بر عهده تو نیست.');
  assert.equal(day11.actionText, 'در یک موقعیت کم‌خطر، یک مرز یا محدودیت را با جمله‌ای کوتاه و محترمانه بیان کن؛ اگر بیان مستقیم امن یا مناسب نیست، آن را برای گفت‌وگو با فرد قابل اعتماد آماده کن. پس از گفتن جمله، لازم نیست واکنش دیگران را کنترل کنی؛ فقط روشن بودن پیام خودت را بررسی کن.');
  const ui = await readFile(new URL('../src/features/journey/JourneyScreens.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(ui, /getT01PausePlan|t01PausePlan/);
});

test('production topic name resolves T01 day 10 when runtime IDs omit topic metadata', () => {
  const plan = getT01PausePlan({ day: 10, instructions: 'تمرین روزانه' }, 'خشم');
  assert.match(plan, /یک برنامه مکث امن با سه جزء بنویس/);
});

test('production anger-category ID resolves T01 day 10 without optional metadata', () => {
  const plan = getT01PausePlan({ id: 'خشم-10', day: 10, instructions: 'تمرین روزانه' });
  assert.match(plan, /یک برنامه مکث امن با سه جزء بنویس/);
});

test('legacy canonical ID resolves T01 day 10 without optional metadata', () => {
  const plan = getT01PausePlan({ id: 'T01-D10', instructions: 'تمرین روزانه' });
  assert.match(plan, /یک برنامه مکث امن با سه جزء بنویس/);
});

test('pause plan is not attached to other topics or days', () => {
  assert.equal(getT01PausePlan({ topic_id: 'T01', day: 9 }), '');
  assert.equal(getT01PausePlan({ topic_id: 'T02', day: 10 }), '');
  assert.equal(getT01PausePlan({ id: 'T01-D09' }), '');
  assert.equal(getT01PausePlan({ id: 'T02-D10' }), '');
  assert.equal(getT01PausePlan({ id: 'خشم-09', day: 9 }), '');
  assert.equal(getT01PausePlan({ id: 'غم-10', day: 10 }), '');
  assert.equal(getT01PausePlan({ id: 'غم-10', day: 10 }, 'خشم'), '');
  assert.equal(getT01PausePlan({ id: 'خشم-09', day: 10 }, 'خشم'), '');
  assert.equal(getT01PausePlan({ topic_id: 'T02', id: 'T02-D10', day: 10 }, 'خشم'), '');
  assert.equal(getT01PausePlan({ topic_id: 'T01', id: 'T01-D09', day: 10 }), '');
  assert.equal(getT01PausePlan({ topic_id: 'T02', id: 'خشم-10', day: 10 }), '');
  assert.equal(getT01PausePlan(null), '');
});
