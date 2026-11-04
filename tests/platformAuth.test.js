import test from "node:test";
import assert from "node:assert/strict";
import { verifyMiniAppInitData } from "../workers/assistant-api/src/platformAuth.js";

const encoder = new TextEncoder();
const NOW = 1_800_000_000;
const TELEGRAM_TOKEN = "test-only-telegram-bot-token";
const BALE_TOKEN = "test-only-bale-bot-token";

async function hmac(keyBytes, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

function toHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function makeInitData({
  token,
  authDate = NOW,
  user = { id: 123456789, first_name: "Test" },
  extra = {},
} = {}) {
  const fields = new URLSearchParams({
    auth_date: String(authDate),
    query_id: "test-query-id",
    user: JSON.stringify(user),
    ...extra,
  });
  const checkString = [...fields.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const platformSecret = await hmac(encoder.encode("WebAppData"), token);
  const signature = await hmac(platformSecret, checkString);
  fields.set("hash", toHex(signature));
  return fields.toString();
}

test("verifies valid Telegram initData without returning user identifiers or profile data", async () => {
  const initData = await makeInitData({ token: TELEGRAM_TOKEN });
  const result = await verifyMiniAppInitData({
    platform: "telegram",
    initData,
    env: { TELEGRAM_BOT_TOKEN: TELEGRAM_TOKEN },
    nowSeconds: NOW,
  });

  assert.deepEqual(result, { valid: true, platform: "telegram", authDate: NOW });
  assert.equal("user" in result, false);
  assert.equal("userId" in result, false);
  assert.equal("queryId" in result, false);
});

test("verifies valid Bale initData with a separate platform token", async () => {
  const initData = await makeInitData({ token: BALE_TOKEN });
  const result = await verifyMiniAppInitData({
    platform: "bale",
    initData,
    env: { BALE_BOT_TOKEN: BALE_TOKEN },
    nowSeconds: NOW,
  });

  assert.deepEqual(result, { valid: true, platform: "bale", authDate: NOW });
});

test("rejects a signature generated for a different platform token", async () => {
  const initData = await makeInitData({ token: TELEGRAM_TOKEN });
  const result = await verifyMiniAppInitData({
    platform: "bale",
    initData,
    env: { BALE_BOT_TOKEN: BALE_TOKEN },
    nowSeconds: NOW,
  });

  assert.equal(result.valid, false);
  assert.equal(result.reason, "invalid_signature");
});

test("rejects tampered fields", async () => {
  const initData = await makeInitData({ token: TELEGRAM_TOKEN });
  const tampered = initData.replace("first_name%22%3A%22Test", "first_name%22%3A%22Evil");
  const result = await verifyMiniAppInitData({
    platform: "telegram",
    initData: tampered,
    env: { TELEGRAM_BOT_TOKEN: TELEGRAM_TOKEN },
    nowSeconds: NOW,
  });

  assert.equal(result.valid, false);
});

test("rejects expired initData", async () => {
  const initData = await makeInitData({ token: TELEGRAM_TOKEN, authDate: NOW - 301 });
  const result = await verifyMiniAppInitData({
    platform: "telegram",
    initData,
    env: { TELEGRAM_BOT_TOKEN: TELEGRAM_TOKEN },
    nowSeconds: NOW,
  });

  assert.equal(result.reason, "expired_or_future_init_data");
});

test("rejects initData too far in the future", async () => {
  const initData = await makeInitData({ token: TELEGRAM_TOKEN, authDate: NOW + 31 });
  const result = await verifyMiniAppInitData({
    platform: "telegram",
    initData,
    env: { TELEGRAM_BOT_TOKEN: TELEGRAM_TOKEN },
    nowSeconds: NOW,
  });

  assert.equal(result.reason, "expired_or_future_init_data");
});

test("rejects duplicate query fields", async () => {
  const initData = await makeInitData({ token: TELEGRAM_TOKEN });
  const result = await verifyMiniAppInitData({
    platform: "telegram",
    initData: `${initData}&auth_date=${NOW}`,
    env: { TELEGRAM_BOT_TOKEN: TELEGRAM_TOKEN },
    nowSeconds: NOW,
  });

  assert.equal(result.reason, "duplicate_fields");
});

test("rejects malformed or oversized initData", async () => {
  const env = { TELEGRAM_BOT_TOKEN: TELEGRAM_TOKEN };
  const malformed = await verifyMiniAppInitData({
    platform: "telegram", initData: " ", env, nowSeconds: NOW,
  });
  const oversized = await verifyMiniAppInitData({
    platform: "telegram", initData: "x".repeat(8193), env, nowSeconds: NOW,
  });

  assert.equal(malformed.valid, false);
  assert.equal(oversized.reason, "invalid_init_data");
});

test("fails closed when platform credentials are missing or platform is unknown", async () => {
  const missing = await verifyMiniAppInitData({
    platform: "telegram",
    initData: "auth_date=1&user=%7B%22id%22%3A1%7D&hash=" + "0".repeat(64),
    env: {},
    nowSeconds: NOW,
  });
  const unknown = await verifyMiniAppInitData({
    platform: "browser",
    initData: "anything",
    env: {},
    nowSeconds: NOW,
  });

  assert.equal(missing.reason, "platform_not_configured");
  assert.equal(unknown.reason, "unsupported_platform");
});

test("rejects missing or invalid user identity", async () => {
  const noUser = await makeInitData({ token: TELEGRAM_TOKEN, user: undefined });
  const invalidUser = await makeInitData({ token: TELEGRAM_TOKEN, user: { id: 0 } });
  const env = { TELEGRAM_BOT_TOKEN: TELEGRAM_TOKEN };
  const first = await verifyMiniAppInitData({
    platform: "telegram", initData: noUser, env, nowSeconds: NOW,
  });
  const second = await verifyMiniAppInitData({
    platform: "telegram", initData: invalidUser, env, nowSeconds: NOW,
  });

  assert.equal(first.reason, "invalid_user_data");
  assert.equal(second.reason, "invalid_user_data");
});
