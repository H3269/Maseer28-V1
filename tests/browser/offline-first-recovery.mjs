import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const baseURL = process.env.PATH28_BASE_URL || 'http://127.0.0.1:4173/Maseer28-V1/';
const browser = await chromium.launch({ headless: true });

try {
  // Warm the app and its public content cache, then prove a same-WebView
  // offline reload can restore the shell and runtime topic index.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const swResponses = [];
  page.on('response', (response) => {
    if (/content\/runtime-v1\/index\.json/.test(response.url())) {
      swResponses.push({ url: response.url(), fromServiceWorker: response.fromServiceWorker(), status: response.status() });
    }
  });
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.locator('#copyrightModal').waitFor({ state: 'visible', timeout: 45000 });
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#copyrightModal').waitFor({ state: 'visible', timeout: 45000 });
  assert.equal(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)), true,
    'The app should be controlled by its registered service worker after the warm reload');
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#copyrightModal').waitFor({ state: 'visible', timeout: 45000 });
  assert.equal(await page.locator('.loadingError').count(), 0, 'Warm offline launch must not remain on the startup error screen');
  const offlineState = await page.evaluate(() => ({
    controlled: Boolean(navigator.serviceWorker.controller),
    title: document.querySelector('h1')?.textContent || '',
    appVisible: Boolean(document.querySelector('#copyrightModal')),
  }));
  assert.equal(offlineState.controlled, true);
  assert.equal(offlineState.appVisible, true);
  await context.close();

  // Independently verify that the retry control repeats the startup fetch
  // pipeline in the same page after a simulated transient network failure.
  const retryContext = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  const retryPage = await retryContext.newPage();
  let blockContent = true;
  await retryPage.route('**/content/**', async (route) => {
    if (blockContent) await route.abort('internetdisconnected');
    else await route.continue();
  });
  await retryPage.goto(baseURL, { waitUntil: 'domcontentloaded' });
  const retryButton = retryPage.getByRole('button', { name: 'بررسی اتصال و تلاش دوباره' });
  await retryButton.waitFor({ state: 'visible', timeout: 45000 });
  blockContent = false;
  await retryButton.click();
  await retryPage.locator('#copyrightModal').waitFor({ state: 'visible', timeout: 45000 });
  assert.equal(await retryPage.locator('.loadingError').count(), 0, 'A successful retry must clear the startup error');
  await retryContext.close();
  console.log('Offline warm launch and in-place reconnect retry passed.');
} finally {
  await browser.close();
}