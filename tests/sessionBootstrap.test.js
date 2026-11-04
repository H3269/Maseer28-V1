import test from "node:test";
import assert from "node:assert/strict";
import {
  bootstrapAssistantSession,
  fingerprintMiniAppInitData,
} from "../workers/assistant-api/src/sessionBootstrap.js";
import { verifyAssistantSessionToken } from "../workers/assistant-api/src/sessionToken.js";

const NOW = 1_800_000_000;
const INIT_DATA = "signed-init-data-fixture-never-persist-this";
const ENV = Object.freeze({
  TELEGRAM_BOT_TOKEN: "test-only-telegram-token",
  REPLAY_FINGERPRINT_SECRET: "test-only-replay-fingerprint-secret-32-bytes",
  SESSION_SIGNING_SECRET: "test-only-session-signing-secret-32-bytes",
});
const verified = (authDate = NOW - 100) => ({
  valid: true,
  platform: "telegram",
  authDate,
});

function dependencies(overrides = {}) {
  const events = [];
  const captured = {};
  return {
    events,
    captured,
    verifyInitData: async (input) => {
      events.push("verify");
      captured.verifierInput = input;
      return verified();
    },
    issueToken: async (input) => {
      events.push("prepare-token");
      captured.tokenInput = input;
      return "prepared-session-token";
    },
    consumeReplayMarker: async (input) => {
      events.push("consume-replay");
      captured.replayInput = input;
      return true;
    },
    ...overrides,
  };
}

test("bootstraps only after verification, token preparation, and atomic replay consumption", async () => {
  const deps = dependencies();
  const result = await bootstrapAssistantSession({
    platform: "telegram",
    initData: INIT_DATA,
    env: ENV,
    nowSeconds: NOW,
    ...deps,
  });

  assert.deepEqual(deps.events, ["verify", "prepare-token", "consume-replay"]);
  assert.deepEqual(result, {
    ok: true,
    token: "prepared-session-token",
    tokenType: "Bearer",
    expiresInSeconds: 600,
  });
  assert.equal(deps.captured.replayInput.expiresAt, (NOW - 100 + 300 + 30) * 1000);
  assert.match(deps.captured.replayInput.shardName, /^v1:[a-f0-9]{2}$/);
  assert.match(deps.captured.replayInput.fingerprint, /^[a-f0-9]{64}$/);
  assert.deepEqual(Object.keys(deps.captured.replayInput).sort(), ["expiresAt", "fingerprint", "shardName"]);
  assert.equal(JSON.stringify(deps.captured.replayInput).includes(INIT_DATA), false);
  assert.equal(deps.captured.verifierInput.initData, INIT_DATA);
  assert.equal(deps.captured.tokenInput.secret, ENV.SESSION_SIGNING_SECRET);
});

test("rejects invalid platform data before preparing a token or consuming replay state", async () => {
  const deps = dependencies({
    verifyInitData: async () => ({ valid: false, reason: "invalid_signature" }),
  });
  const result = await bootstrapAssistantSession({
    platform: "telegram", initData: INIT_DATA, env: ENV, nowSeconds: NOW, ...deps,
  });

  assert.deepEqual(result, { ok: false, error: "platform_auth_failed", status: 401 });
  assert.deepEqual(deps.events, []);
});

test("rejects verifier results for a different platform", async () => {
  const deps = dependencies({
    verifyInitData: async () => ({ ...verified(), platform: "bale" }),
  });
  const result = await bootstrapAssistantSession({
    platform: "telegram", initData: INIT_DATA, env: ENV, nowSeconds: NOW, ...deps,
  });

  assert.equal(result.error, "platform_auth_failed");
  assert.deepEqual(deps.events, []);
});

test("fails closed for missing or weak secrets and missing replay binding adapter", async () => {
  for (const input of [
    { env: { ...ENV, REPLAY_FINGERPRINT_SECRET: "short" } },
    { env: { ...ENV, SESSION_SIGNING_SECRET: "short" } },
    { env: { TELEGRAM_BOT_TOKEN: ENV.TELEGRAM_BOT_TOKEN } },
  ]) {
    const deps = dependencies();
    const result = await bootstrapAssistantSession({
      platform: "telegram", initData: INIT_DATA, nowSeconds: NOW,
      env: input.env ?? ENV,
      consumeReplayMarker: input.consumeReplayMarker ?? deps.consumeReplayMarker,
      verifyInitData: deps.verifyInitData,
      issueToken: deps.issueToken,
    });
    assert.deepEqual(result, { ok: false, error: "assistant_bootstrap_unavailable", status: 503 });
    assert.deepEqual(deps.events, []);
  }
});

test("does not consume replay state when token preparation fails", async () => {
  const deps = dependencies({
    issueToken: async () => {
      deps.events.push("prepare-token");
      throw new Error("simulated_signing_failure");
    },
  });
  const result = await bootstrapAssistantSession({
    platform: "telegram", initData: INIT_DATA, env: ENV, nowSeconds: NOW, ...deps,
  });

  assert.deepEqual(result, { ok: false, error: "assistant_bootstrap_unavailable", status: 503 });
  assert.deepEqual(deps.events, ["verify", "prepare-token"]);
});

test("duplicate replay marker rejects the request and never returns the prepared token", async () => {
  const deps = dependencies({
    consumeReplayMarker: async () => {
      deps.events.push("consume-replay");
      return false;
    },
  });
  const result = await bootstrapAssistantSession({
    platform: "telegram", initData: INIT_DATA, env: ENV, nowSeconds: NOW, ...deps,
  });

  assert.deepEqual(result, { ok: false, error: "init_data_replayed", status: 409 });
  assert.equal("token" in result, false);
  assert.deepEqual(deps.events, ["verify", "prepare-token", "consume-replay"]);
});

test("Durable Object/storage adapter failure fails closed and returns no token", async () => {
  const deps = dependencies({
    consumeReplayMarker: async () => {
      deps.events.push("consume-replay");
      throw new Error("simulated_storage_failure");
    },
  });
  const result = await bootstrapAssistantSession({
    platform: "telegram", initData: INIT_DATA, env: ENV, nowSeconds: NOW, ...deps,
  });

  assert.deepEqual(result, { ok: false, error: "assistant_bootstrap_unavailable", status: 503 });
  assert.equal("token" in result, false);
});

test("fingerprint is keyed, platform-separated, and fixed-width", async () => {
  const telegram = await fingerprintMiniAppInitData({
    platform: "telegram", initData: INIT_DATA, secret: ENV.REPLAY_FINGERPRINT_SECRET,
  });
  const bale = await fingerprintMiniAppInitData({
    platform: "bale", initData: INIT_DATA, secret: ENV.REPLAY_FINGERPRINT_SECRET,
  });
  const otherSecret = await fingerprintMiniAppInitData({
    platform: "telegram", initData: INIT_DATA, secret: ENV.REPLAY_FINGERPRINT_SECRET + "-other",
  });

  assert.match(telegram, /^[a-f0-9]{64}$/);
  assert.notEqual(telegram, bale);
  assert.notEqual(telegram, otherSecret);
  assert.equal(telegram.includes(INIT_DATA), false);
});

test("fingerprinting rejects unsupported platforms, oversized data, and weak secrets", async () => {
  await assert.rejects(() => fingerprintMiniAppInitData({
    platform: "web", initData: INIT_DATA, secret: ENV.REPLAY_FINGERPRINT_SECRET,
  }), /unsupported_platform/);
  await assert.rejects(() => fingerprintMiniAppInitData({
    platform: "telegram", initData: "x".repeat(8193), secret: ENV.REPLAY_FINGERPRINT_SECRET,
  }), /invalid_init_data/);
  await assert.rejects(() => fingerprintMiniAppInitData({
    platform: "telegram", initData: INIT_DATA, secret: "weak",
  }), /invalid_replay_fingerprint_secret/);
});

test("fails closed when the replay adapter is absent", async () => {
  const deps = dependencies();
  const result = await bootstrapAssistantSession({
    platform: "telegram",
    initData: INIT_DATA,
    env: ENV,
    nowSeconds: NOW,
    verifyInitData: deps.verifyInitData,
    issueToken: deps.issueToken,
  });

  assert.deepEqual(result, { ok: false, error: "assistant_bootstrap_unavailable", status: 503 });
  assert.deepEqual(deps.events, []);
});

test("rejects reused secrets across fingerprint, session signing, and platform credentials", async () => {
  const reused = [
    { ...ENV, SESSION_SIGNING_SECRET: ENV.REPLAY_FINGERPRINT_SECRET },
    { ...ENV, REPLAY_FINGERPRINT_SECRET: ENV.TELEGRAM_BOT_TOKEN },
    { ...ENV, SESSION_SIGNING_SECRET: ENV.TELEGRAM_BOT_TOKEN },
  ];
  for (const env of reused) {
    const deps = dependencies();
    const result = await bootstrapAssistantSession({
      platform: "telegram",
      initData: INIT_DATA,
      env,
      nowSeconds: NOW,
      ...deps,
    });
    assert.deepEqual(result, { ok: false, error: "assistant_bootstrap_unavailable", status: 503 });
    assert.deepEqual(deps.events, []);
  }
});

async function hmac(keyBytes, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
}

function toHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function makeTelegramInitData() {
  const fields = new URLSearchParams({
    auth_date: String(NOW),
    query_id: "bootstrap-integration-fixture",
    user: JSON.stringify({ id: 987654321, first_name: "Fixture" }),
  });
  const platformSecret = await hmac(new TextEncoder().encode("WebAppData"), ENV.TELEGRAM_BOT_TOKEN);
  const checkString = [...fields.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  fields.set("hash", toHex(await hmac(platformSecret, checkString)));
  return fields.toString();
}

test("integrates real Telegram verification, keyed replay fingerprint, and signed session token", async () => {
  const initData = await makeTelegramInitData();
  let replayInput;
  const result = await bootstrapAssistantSession({
    platform: "telegram",
    initData,
    env: ENV,
    nowSeconds: NOW,
    consumeReplayMarker: async (input) => {
      replayInput = input;
      return true;
    },
  });

  assert.equal(result.ok, true);
  const token = await verifyAssistantSessionToken({
    token: result.token,
    secret: ENV.SESSION_SIGNING_SECRET,
    nowSeconds: NOW + 1,
  });
  assert.equal(token.valid, true);
  assert.equal(token.session.scope, "assistant:turn");
  assert.match(replayInput.fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(replayInput.expiresAt, (NOW + 300 + 30) * 1000);
  assert.equal(JSON.stringify(replayInput).includes(initData), false);
});
