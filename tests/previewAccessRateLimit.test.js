import test from "node:test";
import assert from "node:assert/strict";
import { createPreviewAccessRateLimiter } from "../workers/assistant-api/src/previewAccessRateLimit.js";

const SECRET = "preview-access-rate-limit-secret-32-bytes";
const NOW = 1_800_000_000;

test("Preview access limiter fails closed when the trusted client address is unavailable", async () => {
  const limiter = createPreviewAccessRateLimiter({}, SECRET);
  const result = await limiter.consume(undefined, NOW);
  assert.deepEqual(result, {
    allowed: false,
    reason: "preview_access_rate_limit_unavailable",
  });
});

test("Preview access limiter fails closed without a strong keyed-hash secret", async () => {
  const limiter = createPreviewAccessRateLimiter({}, "too-short");
  const result = await limiter.consume("203.0.113.10", NOW);
  assert.deepEqual(result, {
    allowed: false,
    reason: "preview_access_rate_limit_unavailable",
  });
});

test("Preview access limiter fails closed when Durable Object binding is absent", async () => {
  const limiter = createPreviewAccessRateLimiter(null, SECRET);
  const result = await limiter.consume("203.0.113.10", NOW);
  assert.deepEqual(result, {
    allowed: false,
    reason: "preview_access_rate_limit_unavailable",
  });
});
