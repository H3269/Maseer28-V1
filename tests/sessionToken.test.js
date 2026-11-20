import test from "node:test";
import assert from "node:assert/strict";
import { createAssistantSessionToken, verifyAssistantSessionToken } from "../workers/assistant-api/src/sessionToken.js";

const SECRET = "test-only-session-signing-secret-32-bytes-minimum";
const NOW = 1_800_000_000;

async function signedToken(payload, header = { alg: "HS256", typ: "JWT" }) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const input = encode(header) + "." + encode(payload);
  const { createHmac } = await import("node:crypto");
  return input + "." + createHmac("sha256", SECRET).update(input).digest("base64url");
}

test("issues and verifies a minimal short-lived session token", async () => {
  const token = await createAssistantSessionToken({ secret: SECRET, nowSeconds: NOW });
  const result = await verifyAssistantSessionToken({ token, secret: SECRET, nowSeconds: NOW + 1 });
  assert.equal(result.valid, true);
  assert.equal(result.session.scope, "assistant:turn");
  assert.equal(result.session.issuedAt, NOW);
  assert.equal(result.session.expiresAt, NOW + 600);
  assert.match(result.session.sessionId, /^[A-Za-z0-9_-]{32}$/);
  assert.deepEqual(Object.keys(result.session).sort(), ["expiresAt", "issuedAt", "scope", "sessionId"]);
});

test("rejects a token signed with a different secret", async () => {
  const token = await createAssistantSessionToken({ secret: SECRET, nowSeconds: NOW });
  const result = await verifyAssistantSessionToken({ token, secret: SECRET + "-wrong", nowSeconds: NOW });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "invalid_session_signature");
});

test("rejects tampered claims", async () => {
  const token = await createAssistantSessionToken({ secret: SECRET, nowSeconds: NOW });
  const [h, p, s] = token.split(".");
  const changed = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, "base64url").toString()), scope: "admin" })).toString("base64url");
  const result = await verifyAssistantSessionToken({ token: h + "." + changed + "." + s, secret: SECRET, nowSeconds: NOW });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "invalid_session_signature");
});

test("rejects expired and future-issued tokens", async () => {
  const token = await createAssistantSessionToken({ secret: SECRET, nowSeconds: NOW });
  assert.equal((await verifyAssistantSessionToken({ token, secret: SECRET, nowSeconds: NOW + 600 })).reason, "session_expired");
  const future = await createAssistantSessionToken({ secret: SECRET, nowSeconds: NOW + 31 });
  assert.equal((await verifyAssistantSessionToken({ token: future, secret: SECRET, nowSeconds: NOW })).reason, "session_issued_in_future");
});

test("rejects malformed, oversized and wrong-algorithm tokens", async () => {
  assert.equal((await verifyAssistantSessionToken({ token: "x.y.z", secret: SECRET, nowSeconds: NOW })).valid, false);
  assert.equal((await verifyAssistantSessionToken({ token: "x".repeat(2049), secret: SECRET, nowSeconds: NOW })).valid, false);
  const token = await signedToken({
    v: 1, iss: "maseer28-assistant-api", aud: "maseer28-assistant",
    scope: "assistant:turn", sid: "A".repeat(32), iat: NOW, exp: NOW + 60,
  }, { alg: "none", typ: "JWT" });
  assert.equal((await verifyAssistantSessionToken({ token, secret: SECRET, nowSeconds: NOW })).reason, "invalid_session_algorithm");
});

test("rejects unexpected claims, invalid scope and excessive signed lifetime", async () => {
  const base = {
    v: 1, iss: "maseer28-assistant-api", aud: "maseer28-assistant",
    scope: "assistant:turn", sid: "A".repeat(32), iat: NOW, exp: NOW + 60,
  };
  const extra = await signedToken({ ...base, userId: "123" });
  assert.equal((await verifyAssistantSessionToken({ token: extra, secret: SECRET, nowSeconds: NOW })).reason, "invalid_session_claims");
  const wrongScope = await signedToken({ ...base, scope: "admin" });
  assert.equal((await verifyAssistantSessionToken({ token: wrongScope, secret: SECRET, nowSeconds: NOW })).reason, "invalid_session_claims");
  const longLived = await signedToken({ ...base, exp: NOW + 601 });
  assert.equal((await verifyAssistantSessionToken({ token: longLived, secret: SECRET, nowSeconds: NOW })).reason, "invalid_session_claims");
});

test("requires a strong signing secret and caps requested TTL", async () => {
  await assert.rejects(() => createAssistantSessionToken({ secret: "too-short", nowSeconds: NOW }), /invalid_session_signing_secret/);
  await assert.rejects(() => createAssistantSessionToken({ secret: SECRET, nowSeconds: NOW, ttlSeconds: 601 }), /invalid_session_ttl/);
  await assert.rejects(() => createAssistantSessionToken({ secret: SECRET, nowSeconds: NOW, ttlSeconds: 0 }), /invalid_session_ttl/);
});

test("missing signing configuration fails closed during verification", async () => {
  const result = await verifyAssistantSessionToken({ token: "x.y.z", secret: "", nowSeconds: NOW });
  assert.deepEqual(result, { valid: false, reason: "session_verifier_not_configured" });
});
