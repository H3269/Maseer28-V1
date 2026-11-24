import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/features/journey/JourneyScreens.jsx', import.meta.url), 'utf8');

test('support and channel actions use distinct icons matching their purpose', () => {
  assert.match(source, /<AppIcon name="headset" size={17} \/><\/span><span className="m28ActionText">ورود به پشتیبانی تلگرام/);
  assert.match(source, /<AppIcon name="megaphone" size={17} \/><\/span><span className="m28ActionText">ورود به کانال مرکز/);
});

test('severity value stays muted before selection and follows the slider gradient after selection', () => {
  assert.match(source, /data-touched={touched \? '1' : '0'}/);
  assert.match(source, /backgroundColor: touched \? severityColorForScore\(score\) : '#edf1f3'/);
  assert.match(source, /color: touched \? severityValueTextColor\(severityColorForScore\(score\)\) : '#5f6d75'/);
  assert.match(source, /onChange=\{\(e\) => \{ setScore\(Number\(e\.target\.value\)\); setTouched\(true\); \}\}/);
});

test('score color interpolates across every point of the five-stop track gradient', () => {
  assert.match(source, /\[0, \[79, 159, 109\]\]/);
  assert.match(source, /\[2\.5, \[135, 185, 109\]\]/);
  assert.match(source, /\[5, \[225, 198, 87\]\]/);
  assert.match(source, /\[7\.5, \[223, 150, 80\]\]/);
  assert.match(source, /\[10, \[201, 78, 74\]\]/);
});
