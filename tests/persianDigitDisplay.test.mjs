import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { faDigits } from '../src/shared/persianDigitDisplay.js';

test('visible digit formatter converts every ASCII digit to Persian digits', () => {
  assert.equal(faDigits('روز 28، امتیاز 10 از 10، صفحه 125'), 'روز ۲۸، امتیاز ۱۰ از ۱۰، صفحه ۱۲۵');
});

test('visible digit formatter preserves Persian digits, letters and punctuation', () => {
  assert.equal(faDigits('۱۴۰۵/۰۸/۱۷ · مسیر۲۸ · ABC-12'), '۱۴۰۵/۰۸/۱۷ · مسیر۲۸ · ABC-۱۲');
});

test('visible digit formatter handles numeric and empty values safely', () => {
  assert.equal(faDigits(2026), '۲۰۲۶');
  assert.equal(faDigits(null), '');
});

test('app entrypoint imports and installs the Persian digit display observer', async () => {
  const entrypoint = await (await import('node:fs/promises')).readFile(
    new URL('../src/main.jsx', import.meta.url),
    'utf8',
  );
  assert.match(entrypoint, /import\s*\{\s*installPersianDigitDisplay\s*\}\s*from\s*['"]\.\.\/src\/shared\/persianDigitDisplay\.js['"]/);
  assert.match(entrypoint, /installPersianDigitDisplay\(appRoot\)/);
});
