import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/features/journey/JourneyScreens.jsx', import.meta.url), 'utf8');

test('support and channel actions use distinct icons matching their purpose', () => {
  assert.ok(source.includes('<AppIcon name="headset" size={17} /></span><span className="m28ActionText">ورود به پشتیبانی تلگرام'));
  assert.ok(source.includes('<AppIcon name="megaphone" size={17} /></span><span className="m28ActionText">ورود به کانال مرکز'));
});

test('severity value stays muted before selection and follows the slider gradient after selection', () => {
  assert.ok(source.includes("data-touched={touched ? '1' : '0'}"));
  assert.ok(source.includes("'--severity-value-background': touched ? severityColorForScore(score) : '#edf1f3'"));
  assert.ok(source.includes("'--severity-value-foreground': touched ? severityValueTextColor(severityColorForScore(score)) : '#52616a'"));
  assert.ok(source.includes('setScore(Number(e.target.value)); setTouched(true);'));
});

test('score color interpolates across every point of the five-stop track gradient', () => {
  for (const stop of [
    '[0, [79, 159, 109]]',
    '[2.5, [135, 185, 109]]',
    '[5, [225, 198, 87]]',
    '[7.5, [223, 150, 80]]',
    '[10, [201, 78, 74]]',
  ]) assert.ok(source.includes(stop), `Missing gradient stop: ${stop}`);
});


test('preview stylesheet does not override the live severity value color', async () => {
  const stylesheet = await readFile(new URL('../src/styles/iranian-turquoise-preview.css', import.meta.url), 'utf8');
  assert.doesNotMatch(stylesheet, /\.app\s+\.severityValue\s*\{[^}]*!important/s);
});


test('legacy teal gradient cannot cover the live score bubble background or text color', async () => {
  const stylesheet = await readFile(new URL('../src/styles/legacy.css', import.meta.url), 'utf8');
  assert.match(stylesheet, /\.app #day \.severityValue\s*\{[^}]*background:\s*var\(--severity-value-background, #edf1f3\) !important;[^}]*color:\s*var\(--severity-value-foreground, #52616a\) !important;[^}]*background-image:\s*none !important;/s);
});
