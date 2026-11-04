import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readJson = async (path) => JSON.parse(await readFile(
  new URL(path, import.meta.url),
  "utf8",
));
const consent = await readJson("../public/assistant/privacy/consent-policy.v1.json");
const boundaries = await readJson("../public/assistant/privacy/safety-data-boundaries.v1.json");

test("assistant consent remains design-only and every purpose defaults to false", () => {
  assert.equal(consent.status, "design_only_not_active");
  assert.deepEqual(consent.default_consent, {
    ai_cloud_processing: false,
    sensitive_health_data_processing: false,
    long_term_ai_memory: false,
    product_analytics: false,
  });
  for (const purpose of consent.purposes) assert.equal(purpose.default, false, purpose.id);
  const cloud = consent.purposes.find((purpose) => purpose.id === "ai_cloud_processing");
  assert.deepEqual(cloud.requires, {
    policy_version: true,
    processor_identity: true,
    processing_region: true,
    data_categories: true,
    retention_period: true,
    withdrawal_method: true,
  });
});

test("assistant safety and data-boundary contract does not claim active enforcement", () => {
  assert.equal(boundaries.status, "design_only_not_active");
  assert.equal(boundaries.runtime_enforcement, false);
  assert.equal(boundaries.current_state_constraints.cloud_assistant_is_not_implemented, true);
  assert.equal(boundaries.retention.status, "unresolved_blocking_backend_release");
  assert.equal(boundaries.crisis_safety.status, "design_only_requires_specialist_validation");
  assert.ok(boundaries.release_gates.includes("privacy_and_security_specialist_review"));
  assert.ok(boundaries.release_gates.includes("clinical_or_crisis_specialist_review_of_crisis_language_and_test_cases"));
});

test("provider decision record explicitly blocks cloud activation until owner choice", async () => {
  const memo = await readFile(
    new URL("../docs/ASSISTANT_PROVIDER_PRIVACY_DECISION_FA.md", import.meta.url),
    "utf8",
  );
  assert.match(memo, /تصمیم ارائه‌دهنده هنوز گرفته نشده است/);
  assert.match(memo, /پردازش inference در شبکه جهانی Cloudflare/);
  assert.match(memo, /OpenAI API/);
  assert.match(memo, /هیچ درخواست کاربر به هیچ مدل ابری ارسال نمی‌شود/);
});
