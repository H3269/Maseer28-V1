import {
  MAX_AUTH_AGE_SECONDS,
  MAX_FUTURE_SKEW_SECONDS,
  verifyMiniAppInitData,
} from "./platformAuth.js";
import { createAssistantSessionToken } from "./sessionToken.js";

const encoder = new TextEncoder();
const FINGERPRINT_SECRET_MIN_BYTES = 32;
const SESSION_SECRET_MIN_BYTES = 32;
const SHARD_PREFIX_HEX_LENGTH = 2;

function hasStrongSecret(value, minimumBytes) {
  return typeof value === "string"
    && encoder.encode(value).byteLength >= minimumBytes;
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Produces a keyed, domain-separated fingerprint. Raw initData is used only
 * as transient HMAC input; it is never returned, persisted, or logged here.
 */
export async function fingerprintMiniAppInitData({
  platform,
  initData,
  secret,
  cryptoImpl = globalThis.crypto,
} = {}) {
  if (!["telegram", "bale"].includes(platform)) {
    throw new TypeError("unsupported_platform");
  }
  if (typeof initData !== "string" || initData.length === 0 || initData.length > 8 * 1024) {
    throw new TypeError("invalid_init_data");
  }
  if (!hasStrongSecret(secret, FINGERPRINT_SECRET_MIN_BYTES)) {
    throw new TypeError("invalid_replay_fingerprint_secret");
  }
  if (!cryptoImpl?.subtle) throw new TypeError("web_crypto_unavailable");

  const key = await cryptoImpl.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const message = encoder.encode(`maseer28:init-data-fingerprint:v1\n${platform}\n${initData}`);
  const digest = await cryptoImpl.subtle.sign("HMAC", key, message);
  return bytesToHex(new Uint8Array(digest));
}

function failure(error, status) {
  return Object.freeze({ ok: false, error, status });
}

/**
 * Coordinates host verification, keyed anti-replay fingerprinting and token
 * preparation. The caller injects the Durable Object operation so this
 * orchestrator remains independently testable and cannot silently create or
 * activate a production binding.
 *
 * The token is prepared in memory before consuming the replay marker so a
 * signing failure cannot burn otherwise-valid initData. It is never returned
 * unless the atomic replay operation succeeds.
 */
export async function bootstrapAssistantSession({
  platform,
  initData,
  env = {},
  nowSeconds = Math.floor(Date.now() / 1000),
  cryptoImpl = globalThis.crypto,
  verifyInitData = verifyMiniAppInitData,
  consumeReplayMarker,
  issueToken = createAssistantSessionToken,
} = {}) {
  if (
    !hasStrongSecret(env.REPLAY_FINGERPRINT_SECRET, FINGERPRINT_SECRET_MIN_BYTES)
    || !hasStrongSecret(env.SESSION_SIGNING_SECRET, SESSION_SECRET_MIN_BYTES)
    || typeof consumeReplayMarker !== "function"
  ) {
    return failure("assistant_bootstrap_unavailable", 503);
  }

  let verified;
  try {
    verified = await verifyInitData({
      platform,
      initData,
      env,
      nowSeconds,
    });
  } catch {
    return failure("platform_auth_failed", 401);
  }
  if (!verified?.valid || verified.platform !== platform
    || !Number.isSafeInteger(verified.authDate) || verified.authDate <= 0) {
    return failure("platform_auth_failed", 401);
  }

  let fingerprint;
  try {
    fingerprint = await fingerprintMiniAppInitData({
      platform,
      initData,
      secret: env.REPLAY_FINGERPRINT_SECRET,
      cryptoImpl,
    });
  } catch {
    return failure("assistant_bootstrap_unavailable", 503);
  }

  const shardName = `v1:${fingerprint.slice(0, SHARD_PREFIX_HEX_LENGTH)}`;
  const expiresAt = (
    verified.authDate + MAX_AUTH_AGE_SECONDS + MAX_FUTURE_SKEW_SECONDS
  ) * 1000;

  let token;
  try {
    token = await issueToken({
      secret: env.SESSION_SIGNING_SECRET,
      nowSeconds,
      cryptoImpl,
    });
    if (typeof token !== "string" || token.length === 0) {
      return failure("assistant_bootstrap_unavailable", 503);
    }
  } catch {
    return failure("assistant_bootstrap_unavailable", 503);
  }

  let consumed;
  try {
    consumed = await consumeReplayMarker({ shardName, fingerprint, expiresAt });
  } catch {
    return failure("assistant_bootstrap_unavailable", 503);
  }
  if (consumed !== true) return failure("init_data_replayed", 409);

  return Object.freeze({
    ok: true,
    token,
    tokenType: "Bearer",
    expiresInSeconds: 600,
  });
}
