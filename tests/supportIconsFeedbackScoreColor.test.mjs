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


test('live score bubble override is in the stylesheet actually imported by the app', async () => {
  const appEntry = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8');
  const stylesheet = await readFile(new URL('../src/styles/original-v72.css', import.meta.url), 'utf8');
  assert.ok(appEntry.includes("import './styles/original-v72.css'"));
  assert.match(stylesheet, /\.app #day \.severityValue\s*\{[^}]*background:\s*var\(--severity-value-background, #edf1f3\) !important;[^}]*color:\s*var\(--severity-value-foreground, #52616a\) !important;[^}]*background-image:\s*none !important;/s);
});

test('support and channel link icons override the preview theme lapis SVG color on lapis buttons', async () => {
  const stylesheet = await readFile(new URL('../src/styles/iranian-turquoise-preview.css', import.meta.url), 'utf8');
  const selector = '.app > section.card#support .support a.telegram.m28IconAction > .m28ActionIcon > svg';
  const start = stylesheet.indexOf(selector);
  const end = stylesheet.indexOf('}', start);
  const rule = start >= 0 && end > start ? stylesheet.slice(start, end) : '';
  assert.ok(rule.includes('color: #FFFFFF !important'));
  assert.ok(rule.includes('stroke: currentColor !important'));
  assert.ok(rule.includes('width: 17px !important'));
  assert.ok(rule.includes('height: 17px !important'));
  assert.ok(stylesheet.includes('.app svg {\\n  color: #245A9A;'));
});
