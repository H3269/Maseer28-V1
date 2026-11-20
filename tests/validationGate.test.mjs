import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const publishWorkflow = await fs.readFile(
  new URL('../.github/workflows/publish-tested-version.yml', import.meta.url),
  'utf8',
);

test('Telegram publication validates the exact checked-out source without a separate workflow dependency', () => {
  assert.doesNotMatch(publishWorkflow, /validate-content\.yml|assert-validation-run\.mjs/);
  assert.match(publishWorkflow, /ref: \$\{\{ github\.sha \}\}/);
  assert.match(publishWorkflow, /npm run validate:content/);
  assert.match(publishWorkflow, /npm run validate:assistant-topics/);
  assert.match(publishWorkflow, /npm test/);
  assert.match(publishWorkflow, /npm run build -- --base=\/Maseer28-V1\//);
  assert.match(publishWorkflow, /tests\/browser\/\*\.mjs/);
});

test('release validation happens before the Telegram destination secret is used', () => {
  const validationPosition = publishWorkflow.indexOf('Install dependencies and validate release source');
  const destinationPosition = publishWorkflow.indexOf('Checkout Telegram repository');
  assert.ok(validationPosition >= 0 && destinationPosition > validationPosition);
  assert.match(publishWorkflow, /persist-credentials: false/);
});

test('release browser checks use headless-only Chromium and bounded parallel execution with failure propagation', () => {
  assert.match(publishWorkflow, /playwright install-deps chromium/);
  assert.match(publishWorkflow, /playwright install --only-shell chromium/);
  assert.match(publishWorkflow, /xargs -0 -P 3/);
  assert.match(publishWorkflow, /browser_test_status=\\$\\?/);
  assert.match(publishWorkflow, /exit "\\$browser_test_status"/);
  assert.match(publishWorkflow, /cat "\\$log_file"/);
});
