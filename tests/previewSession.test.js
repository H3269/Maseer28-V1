import test from "node:test";
import assert from "node:assert/strict";
import {
  createAssistantPreviewSession,
  verifyAssistantPreviewSession,
} from "../workers/assistant-api/src/previewSession.js";

const ACCESS_CODE = "preview-access-code-for-owner-only-32-bytes";
const SIGNING_SECRET = "preview-session-signing-secret-32-bytes";
const POLICY_VERSION = "assistant-preview-consent-v1";
const ENV = Object.freeze({
  ASSISTANT_PREVIEW_ENABLED: "true",
  ASSISTANT_PREVIEW_ACCESS_CODE: ACCESS_CODE,
  PREVIEW_SESSION_SIGNING_SECRET: SIGNING_SECRET,
  ASSISTANT_CONSENT_POLICY_VERSION: POLICY_VERSION,
});
const CONSENT = Object.freeze({
  cloudAiProcessing: true,
  sensitiveDataProcessing: true,
  policyVersion: POLICY_VERSION,
});
const NOW = 1_800_000_000;

async function issue(overrides = {}) {
  return createAssistantPreviewSession({
    accessCode: ACCESS_CODE,
    consent: CONSENT,
    env: ENV,
    nowSeconds: NOW,
    ...overrides,
  });
}

test("preview session is unavailable unless preview mode is explicitly enabled", async () => {
  const result = await issue({
    env: { ...ENV, ASSISTANT_PREVIEW_ENABLED: "false" },
  });
  assert.deepEqual(result, { ok: false, error: "preview_not_available", status: 404 });
});

test("requires strong Preview-only secrets and a policy version", async () => {
  const weak = await issue({
    env: { ...ENV, PREVIEW_SESSION_SIGNING_SECRET: "short" },
  });
  assert.equal(weak.error, "preview_session_not_configured");
  assert.equal(weak.status, 503);

  const noPolicy = await issue({
    env: { ...ENV, ASSISTANT_CONSENT_POLICY_VERSION: "" },
  });
  assert.equal(noPolicy.error, "preview_session_not_configured");
});

test("rejects an incorrect Preview access code without issuing a token", async () => {
  const result = await issue({ accessCode: "incorrect-preview-access-code" });
  assert.deepEqual(result, { ok: false, error: "preview_access_denied", status: 401 });
});

test("requires both cloud AI and sensitive-data consent for the current policy", async () => {
  for (const consent of [
    { cloudAiProcessing: true, sensitiveDataProcessing: false, policyVersion: POLICY_VERSION },
    { cloudAiProcessing: false, sensitiveDataProcessing: true, policyVersion: POLICY_VERSION },
    { cloudAiProcessing: true, sensitiveDataProcessing: true, policyVersion: "old-policy" },
    { cloudAiProcessing: true, policyVersion: POLICY_VERSION },
  ]) {
    const result = await issue({ consent });
    assert.deepEqual(result, { ok: false, error: "cloud_consent_required", status: 403 });
  }
});

test("issues a short-lived stateless token and verifies the consent capability", async () => {
  const issued = await issue();
  assert.equal(issued.ok, true);
  assert.equal(issued.tokenType, "Bearer");
  assert.equal(issued.expiresInSeconds, 900);
  assert.equal(issued.policyVersion, POLICY_VERSION);
  assert.equal(issued.token.includes(ACCESS_CODE), false);

  const verified = await verifyAssistantPreviewSession({
    token: issued.token,
    env: ENV,
    nowSeconds: NOW + 1,
  });
  assert.equal(verified.valid, true);
  assert.equal(verified.session.scope, "assistant:preview");
  assert.equal(verified.session.expiresAt, NOW + 900);
  assert.deepEqual(verified.consentVerified, CONSENT);
  assert.equal("userId" in verified.session, false);
});

test("rejects tampered, malformed, and expired Preview tokens", async () => {
  const issued = await issue();
  const [header, payload, signature] = issued.token.split(".");
  const tampered = `${header}.${payload}.${signature.slice(0, -1)}${signature.endsWith("A") ? "B" : "A"}`;

  const invalidSignature = await verifyAssistantPreviewSession({
    token: tampered,
    env: ENV,
    nowSeconds: NOW + 1,
  });
  assert.equal(invalidSignature.valid, false);
  assert.equal(invalidSignature.reason, "invalid_preview_session_signature");

  const malformed = await verifyAssistantPreviewSession({
    token: "not.a.jwt",
    env: ENV,
    nowSeconds: NOW + 1,
  });
  assert.equal(malformed.valid, false);

  const expired = await verifyAssistantPreviewSession({
    token: issued.token,
    env: ENV,
    nowSeconds: NOW + 900,
  });
  assert.equal(expired.valid, false);
  assert.equal(expired.reason, "preview_session_expired");
});

test("policy changes invalidate existing Preview consent tokens", async () => {
  const issued = await issue();
  const verified = await verifyAssistantPreviewSession({
    token: issued.token,
    env: { ...ENV, ASSISTANT_CONSENT_POLICY_VERSION: "new-policy-version" },
    nowSeconds: NOW + 1,
  });
  assert.equal(verified.valid, false);
  assert.equal(verified.reason, "invalid_preview_session_claims");
});

test("refuses tokens when Preview mode is disabled after issuance", async () => {
  const issued = await issue();
  const verified = await verifyAssistantPreviewSession({
    token: issued.token,
    env: { ...ENV, ASSISTANT_PREVIEW_ENABLED: "false" },
    nowSeconds: NOW + 1,
  });
  assert.equal(verified.valid, false);
  assert.equal(verified.reason, "preview_not_available");
});
