import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const baseURL = process.env.PATH28_BASE_URL || 'http://127.0.0.1:4173/Maseer28-V1/';
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage();
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.waitForSelector('#root .app:not(.appLoading)', { timeout: 30000 });

  const result = await page.evaluate(() => {
    const app = document.querySelector('#root .app');
    const day = document.createElement('section');
    day.id = 'day';
    const bubble = document.createElement('div');
    bubble.className = 'severityValue';
    bubble.style.setProperty('--severity-value-background', '#edf1f3');
    bubble.style.setProperty('--severity-value-foreground', '#52616a');
    bubble.textContent = 'انتخاب نشده';
    day.append(bubble);
    app.append(day);
    const before = getComputedStyle(bubble);
    const initial = { backgroundColor: before.backgroundColor, color: before.color, backgroundImage: before.backgroundImage };
    bubble.style.setProperty('--severity-value-background', '#4f9f6d');
    bubble.style.setProperty('--severity-value-foreground', '#ffffff');
    const after = getComputedStyle(bubble);
    return {
      initial,
      selected: { backgroundColor: after.backgroundColor, color: after.color, backgroundImage: after.backgroundImage },
    };
  });

  assert.deepEqual(result.initial, {
    backgroundColor: 'rgb(237, 241, 243)',
    color: 'rgb(82, 97, 106)',
    backgroundImage: 'none',
  });
  assert.deepEqual(result.selected, {
    backgroundColor: 'rgb(79, 159, 109)',
    color: 'rgb(255, 255, 255)',
    backgroundImage: 'none',
  });
  console.log('Feedback score bubble colors render correctly in the active app stylesheet.', JSON.stringify(result));
} finally {
  await browser.close();
}
