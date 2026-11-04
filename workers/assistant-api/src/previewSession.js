const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const ISSUER = "maseer28-assistant-preview";
const AUDIENCE = "maseer28-assistant";
const SCOPE = "assistant:preview";
const TOKEN_TTL_SECONDS = 15 * 60;
const MAX_TOKEN_LENGTH = 2048;
const SECRET_MIN_BYTES = 32;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, keys) {
  return isRecord(value)
    && Object.keys(value).sort().join("|") === [...keys].sort().join("|");
}

function strongSecret(value) {
  return typeof value === "string"
    && encoder.encode(value).byteLength >= SECRET_MIN_BYTES;
}

function failure(error, status) {
  return Object.freeze({ ok: false, error, status });
}

function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function decodeBase64url(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/")
      + "=".repeat((4 - value.length % 4) % 4);
    return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

async function importHmacKey(secret, cryptoImpl, usages) {
  return cryptoImpl.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages,
  );
}

async function signToken(claims, secret, cryptoImpl) {
  const header = base64url(encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = base64url(encoder.encode(JSON.stringify(claims)));
  const input = `${header}.${payload}`;
  const key = await importHmacKey(secret, cryptoImpl, ["sign"]);
  const signature = await cryptoImpl.subtle.sign("HMAC", key, encoder.encode(input));
  return `${input}.${base64url(new Uint8Array(signature))}`;
}

async function constantTimeSecretMatch(provided, expected, cryptoImpl) {
  const [providedDigest, expectedDigest] = await Promise.all([
    cryptoImpl.subtle.digest("SHA-256", encoder.encode(provided)),
    cryptoImpl.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const left = new Uint8Array(providedDigest);
  const right = new Uint8Array(expectedDigest);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

function validConsent(consent, policyVersion) {
  return isRecord(consent)
    && consent.cloudAiProcessing === true
    && consent.sensitiveDataProcessing === true
    && consent.policyVersion === policyVersion;
}

/**
 * Issues a short-lived, stateless access+consent receipt for the isolated
 * browser Preview only. It does not authenticate a real user account.
 */
export async function createAssistantPreviewSession({
  accessCode,
  consent,
  env = {},
  nowSeconds = Math.floor(Date.now() / 1000),
  cryptoImpl = globalThis.crypto,
  sessionGuard,
} = {}) {
  if (env.ASSISTANT_PREVIEW_ENABLED !== "true") {
    return failure("preview_not_available", 404);
  }
  if (
    !strongSecret(env.ASSISTANT_PREVIEW_ACCESS_CODE)
    || !strongSecret(env.PREVIEW_SESSION_SIGNING_SECRET)
    || typeof env.ASSISTANT_CONSENT_POLICY_VERSION !== "string"
    || !env.ASSISTANT_CONSENT_POLICY_VERSION.trim()
    || !Number.isSafeInteger(nowSeconds) || nowSeconds <= 0
    || !cryptoImpl?.subtle
    || typeof cryptoImpl.getRandomValues !== "function"
    || typeof sessionGuard?.create !== "function"
  ) {
    return failure("preview_session_not_configured", 503);
  }
  if (typeof accessCode !== "string" || accessCode.length < 1 || accessCode.length > 256) {
    return failure("preview_access_denied", 401);
  }

  let accessGranted = false;
  try {
    accessGranted = await constantTimeSecretMatch(
      accessCode,
      env.ASSISTANT_PREVIEW_ACCESS_CODE,
      cryptoImpl,
    );
  } catch {
    return failure("preview_session_not_configured", 503);
  }
  if (!accessGranted) return failure("preview_access_denied", 401);

  if (!validConsent(consent, env.ASSISTANT_CONSENT_POLICY_VERSION)) {
    return failure("cloud_consent_required", 403);
  }

  const claims = {
    v: 1,
    iss: ISSUER,
    aud: AUDIENCE,
    scope: SCOPE,
    sid: base64url(cryptoImpl.getRandomValues(new Uint8Array(24))),
    iat: nowSeconds,
    exp: nowSeconds + TOKEN_TTL_SECONDS,
    cloudAiProcessing: true,
    sensitiveDataProcessing: true,
    policyVersion: env.ASSISTANT_CONSENT_POLICY_VERSION,
  };

  let token;
  try {
    token = await signToken(claims, env.PREVIEW_SESSION_SIGNING_SECRET, cryptoImpl);
  } catch {
    return failure("preview_session_not_configured", 503);
  }

  try {
    await sessionGuard.create({
      sessionId: claims.sid,
      expiresAt: claims.exp,
      policyVersion: claims.policyVersion,
      nowSeconds,
    });
  } catch {
    return failure("preview_session_guard_unavailable", 503);
  }

  return Object.freeze({
    ok: true,
    token,
    tokenType: "Bearer",
    expiresInSeconds: TOKEN_TTL_SECONDS,
    policyVersion: claims.policyVersion,
  });
}

/**
 * Verifies a Preview-only token and returns the consent capability consumed
 * by semanticConversation. No persistent consent or conversation record exists.
 */
export async function verifyAssistantPreviewSession({
  token,
  env = {},
  nowSeconds = Math.floor(Date.now() / 1000),
  cryptoImpl = globalThis.crypto,
  sessionGuard,
} = {}) {
  if (env.ASSISTANT_PREVIEW_ENABLED !== "true") {
    return Object.freeze({ valid: false, reason: "preview_not_available" });
  }
  if (!strongSecret(env.PREVIEW_SESSION_SIGNING_SECRET)
    || typeof sessionGuard?.authorize !== "function") {
    return Object.freeze({ valid: false, reason: "preview_session_not_configured" });
  }
  if (!Number.isSafeInteger(nowSeconds) || nowSeconds <= 0 || !cryptoImpl?.subtle) {
    return Object.freeze({ valid: false, reason: "preview_session_verification_unavailable" });
  }
  if (typeof token !== "string" || token.length === 0 || token.length > MAX_TOKEN_LENGTH) {
    return Object.freeze({ valid: false, reason: "invalid_preview_session" });
  }

  const parts = token.split(".");
  if (parts.length !== 3) return Object.freeze({ valid: false, reason: "invalid_preview_session" });
  const [headerPart, payloadPart, signaturePart] = parts;
  const headerBytes = decodeBase64url(headerPart);
  const payloadBytes = decodeBase64url(payloadPart);
  const signature = decodeBase64url(signaturePart);
  if (!headerBytes || !payloadBytes || !signature || signature.length !== 32) {
    return Object.freeze({ valid: false, reason: "invalid_preview_session" });
  }

  let header;
  let claims;
  try {
    header = JSON.parse(decoder.decode(headerBytes));
    claims = JSON.parse(decoder.decode(payloadBytes));
  } catch {
    return Object.freeze({ valid: false, reason: "invalid_preview_session" });
  }
  if (!exactKeys(header, ["alg", "typ"]) || header.alg !== "HS256" || header.typ !== "JWT") {
    return Object.freeze({ valid: false, reason: "invalid_preview_session_algorithm" });
  }

  try {
    const key = await importHmacKey(env.PREVIEW_SESSION_SIGNING_SECRET, cryptoImpl, ["verify"]);
    const signatureValid = await cryptoImpl.subtle.verify(
      "HMAC",
      key,
      signature,
      encoder.encode(`${headerPart}.${payloadPart}`),
    );
    if (!signatureValid) return Object.freeze({ valid: false, reason: "invalid_preview_session_signature" });
  } catch {
    return Object.freeze({ valid: false, reason: "preview_session_verification_unavailable" });
  }

  if (!exactKeys(claims, [
    "v", "iss", "aud", "scope", "sid", "iat", "exp",
    "cloudAiProcessing", "sensitiveDataProcessing", "policyVersion",
  ])
    || claims.v !== 1
    || claims.iss !== ISSUER
    || claims.aud !== AUDIENCE
    || claims.scope !== SCOPE
    || typeof claims.sid !== "string"
    || !/^[A-Za-z0-9_-]{32}$/.test(claims.sid)
    || !Number.isSafeInteger(claims.iat)
    || !Number.isSafeInteger(claims.exp)
    || claims.iat <= 0
    || claims.exp <= claims.iat
    || claims.exp - claims.iat > TOKEN_TTL_SECONDS
    || claims.cloudAiProcessing !== true
    || claims.sensitiveDataProcessing !== true
    || claims.policyVersion !== env.ASSISTANT_CONSENT_POLICY_VERSION) {
    return Object.freeze({ valid: false, reason: "invalid_preview_session_claims" });
  }

  if (claims.iat > nowSeconds + 30) {
    return Object.freeze({ valid: false, reason: "preview_session_issued_in_future" });
  }
  if (claims.exp <= nowSeconds) {
    return Object.freeze({ valid: false, reason: "preview_session_expired" });
  }

  let guardResult;
  try {
    guardResult = await sessionGuard.authorize({
      sessionId: claims.sid,
      expiresAt: claims.exp,
      policyVersion: claims.policyVersion,
      nowSeconds,
    });
  } catch {
    return Object.freeze({ valid: false, reason: "preview_session_guard_unavailable" });
  }
  if (guardResult?.allowed !== true) {
    return Object.freeze({
      valid: false,
      reason: typeof guardResult?.reason === "string"
        ? guardResult.reason
        : "preview_session_guard_unavailable",
    });
  }

  return Object.freeze({
    valid: true,
    session: Object.freeze({
      sessionId: claims.sid,
      scope: claims.scope,
      issuedAt: claims.iat,
      expiresAt: claims.exp,
    }),
    consentVerified: Object.freeze({
      cloudAiProcessing: true,
      sensitiveDataProcessing: true,
      policyVersion: claims.policyVersion,
    }),
  });
}
