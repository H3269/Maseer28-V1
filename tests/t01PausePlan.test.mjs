import test from 'node:test';
import assert from 'node:assert/strict';
import { getT01PausePlan } from '../src/features/journey/t01PausePlan.js';

test('T01 day 10 provides a three-part, conditional pause plan', () => {
  const plan = getT01PausePlan({ topic_id: 'T01', day: 10, id: 'T01-D10' });
  assert.match(plan, /یک برنامه مکث امن با سه جزء بنویس/);
  assert.match(plan, /نشانه مکث/);
  assert.match(plan, /محل فاصله‌گیری/);
  assert.match(plan, /شرط بازگشت/);
  assert.match(plan, /بازگشت فقط با تمایل آزادانه هر دو نفر/);
  assert.match(plan, /اگر درباره مناسب‌بودن شرایط تردید داری/);
});

test('pause plan is not attached to other topics or days', () => {
  assert.equal(getT01PausePlan({ topic_id: 'T01', day: 9 }), '');
  assert.equal(getT01PausePlan({ topic_id: 'T02', day: 10 }), '');
  assert.equal(getT01PausePlan(null), '');
});
