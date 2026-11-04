const encoder = new TextEncoder();
const MAX_INIT_DATA_LENGTH = 8 * 1024;
const MAX_AUTH_AGE_SECONDS = 5 * 60;
const MAX_FUTURE_SKEW_SECONDS = 30;

const PLATFORM_TOKEN_ENV = Object.freeze({
  telegram: "TELEGRAM_BOT_TOKEN",
  bale: "BALE_BOT_TOKEN",
});

function invalid(reason) {
  return Object.freeze({ valid: false, reason });
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function parseUniqueFields(rawInitData) {
  const params = new URLSearchParams(rawInitData);
  const entries = [...params.entries()];
  const keys = new Set();

  for (const [key] of entries) {
    if (keys.has(key)) return null;
    keys.add(key);
  }

  return { params, entries };
}

/**
 * Verify Telegram/Bale Mini App initData using the platform bot token.
 *
 * This function deliberately returns no user profile, user ID, query ID, or
 * raw initData. It is a verification primitive only; it does not issue a
 * session, prevent replay, persist data, or enable any API route.
 */
export async function verifyMiniAppInitData({
  platform,
  initData,
  env = {},
  nowSeconds = Math.floor(Date.now() / 1000),
} = {}) {
  const tokenEnvName = PLATFORM_TOKEN_ENV[platform];
  if (!tokenEnvName) return invalid("unsupported_platform");

  const botToken = env[tokenEnvName];
  if (typeof botToken !== "string" || !botToken.trim()) {
    return invalid("platform_not_configured");
  }

  if (
    typeof initData !== "string" ||
    initData.length === 0 ||
    initData.length > MAX_INIT_DATA_LENGTH
  ) {
    return invalid("invalid_init_data");
  }

  const parsed = parseUniqueFields(initData);
  if (!parsed) return invalid("duplicate_fields");

  const { params, entries } = parsed;
  const receivedHash = params.get("hash");
  const authDateRaw = params.get("auth_date");
  const userRaw = params.get("user");

  if (!receivedHash || !/^[a-f0-9]{64}$/i.test(receivedHash)) {
    return invalid("invalid_signature");
  }

  const authDate = Number(authDateRaw);
  if (!Number.isSafeInteger(authDate) || authDate <= 0) {
    return invalid("invalid_auth_date");
  }

  const ageSeconds = nowSeconds - authDate;
  if (
    ageSeconds > MAX_AUTH_AGE_SECONDS ||
    ageSeconds < -MAX_FUTURE_SKEW_SECONDS
  ) {
    return invalid("expired_or_future_init_data");
  }

  let user;
  try {
    user = JSON.parse(userRaw || "null");
  } catch {
    return invalid("invalid_user_data");
  }

  if (
    !user ||
    typeof user !== "object" ||
    Array.isArray(user) ||
    !Number.isSafeInteger(Number(user.id)) ||
    Number(user.id) <= 0
  ) {
    return invalid("invalid_user_data");
  }

  const dataCheckString = entries
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  try {
    const platformKey = await crypto.subtle.importKey(
      "raw",
      encoder.encode("WebAppData"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const derivedSecret = await crypto.subtle.sign(
      "HMAC",
      platformKey,
      encoder.encode(botToken),
    );
    const signingKey = await crypto.subtle.importKey(
      "raw",
      derivedSecret,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const signatureValid = await crypto.subtle.verify(
      "HMAC",
      signingKey,
      hexToBytes(receivedHash),
      encoder.encode(dataCheckString),
    );

    if (!signatureValid) return invalid("invalid_signature");
  } catch {
    return invalid("verification_failed");
  }

  return Object.freeze({
    valid: true,
    platform,
    authDate,
  });
}
