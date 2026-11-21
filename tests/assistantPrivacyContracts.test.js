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
  assert.ok(boundaries.release_gates.includes("privacy_and_security_controls_verified"));
  assert.ok(boundaries.release_gates.includes("crisis_language_and_emergency_handoff_tested"));
});

test("current privacy contract blocks cloud processing until explicit owner and user consent gates are complete", () => {
  assert.equal(boundaries.current_state_constraints.cloud_assistant_is_not_implemented, true);
  assert.equal(consent.status, "design_only_not_active");
  assert.equal(consent.default_consent.ai_cloud_processing, false);
  assert.equal(consent.default_consent.sensitive_health_data_processing, false);
  assert.ok(boundaries.release_gates.includes("privacy_and_security_controls_verified"));
  assert.ok(boundaries.release_gates.includes("crisis_language_and_emergency_handoff_tested"));
});
