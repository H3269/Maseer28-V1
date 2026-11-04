const enc = new TextEncoder();
const dec = new TextDecoder("utf-8", { fatal: true });
const ISS = "maseer28-assistant-api";
const AUD = "maseer28-assistant";
const SCOPE = "assistant:turn";
const MAX_TTL = 600;
const FUTURE_SKEW = 30;
const MAX_TOKEN = 2048;

const invalid = (reason) => Object.freeze({ valid: false, reason });
const record = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const exactKeys = (v, keys) => record(v)
  && Object.keys(v).sort().join("|") === [...keys].sort().join("|");

function b64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function unb64url(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
    return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  } catch { return null; }
}
function strongSecret(secret) {
  return typeof secret === "string" && enc.encode(secret).byteLength >= 32;
}
function validNow(now) {
  return Number.isSafeInteger(now) && now > 0;
}
function importKey(secret, cryptoImpl, usages) {
  return cryptoImpl.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, usages);
}

/** Stateless token primitive only: no persistence, refresh, PII, or route activation. */
export async function createAssistantSessionToken({
  secret, nowSeconds = Math.floor(Date.now() / 1000), ttlSeconds = MAX_TTL,
  cryptoImpl = globalThis.crypto,
} = {}) {
  if (!strongSecret(secret)) throw new TypeError("invalid_session_signing_secret");
  if (!validNow(nowSeconds)) throw new TypeError("invalid_session_clock");
  if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > MAX_TTL) {
    throw new TypeError("invalid_session_ttl");
  }
  if (!cryptoImpl?.subtle || typeof cryptoImpl.getRandomValues !== "function") {
    throw new TypeError("web_crypto_unavailable");
  }
  const sid = b64url(cryptoImpl.getRandomValues(new Uint8Array(24)));
  const header = b64url(enc.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const claims = b64url(enc.encode(JSON.stringify({
    v: 1, iss: ISS, aud: AUD, scope: SCOPE, sid, iat: nowSeconds, exp: nowSeconds + ttlSeconds,
  })));
  const input = header + "." + claims;
  const key = await importKey(secret, cryptoImpl, ["sign"]);
  const signature = await cryptoImpl.subtle.sign("HMAC", key, enc.encode(input));
  return input + "." + b64url(new Uint8Array(signature));
}

/** Returns only minimal non-PII claims. Authorization, consent, rate limits and safety remain separate. */
export async function verifyAssistantSessionToken({
  token, secret, nowSeconds = Math.floor(Date.now() / 1000), cryptoImpl = globalThis.crypto,
} = {}) {
  if (!strongSecret(secret)) return invalid("session_verifier_not_configured");
  if (!validNow(nowSeconds)) return invalid("invalid_session_clock");
  if (typeof token !== "string" || token.length === 0 || token.length > MAX_TOKEN) return invalid("invalid_session_token");
  if (!cryptoImpl?.subtle) return invalid("session_verification_unavailable");
  const parts = token.split(".");
  if (parts.length !== 3) return invalid("invalid_session_token");
  const [h, p, s] = parts;
  const hb = unb64url(h), pb = unb64url(p), sig = unb64url(s);
  if (!hb || !pb || !sig || sig.length !== 32) return invalid("invalid_session_token");
  let header;
  try { header = JSON.parse(dec.decode(hb)); } catch { return invalid("invalid_session_token"); }
  if (!exactKeys(header, ["alg", "typ"]) || header.alg !== "HS256" || header.typ !== "JWT") {
    return invalid("invalid_session_algorithm");
  }
  try {
    const key = await importKey(secret, cryptoImpl, ["verify"]);
    if (!await cryptoImpl.subtle.verify("HMAC", key, sig, enc.encode(h + "." + p))) {
      return invalid("invalid_session_signature");
    }
  } catch { return invalid("session_verification_unavailable"); }
  let c;
  try { c = JSON.parse(dec.decode(pb)); } catch { return invalid("invalid_session_claims"); }
  if (!exactKeys(c, ["v", "iss", "aud", "scope", "sid", "iat", "exp"])
    || c.v !== 1 || c.iss !== ISS || c.aud !== AUD || c.scope !== SCOPE
    || typeof c.sid !== "string" || !/^[A-Za-z0-9_-]{32}$/.test(c.sid)
    || !Number.isSafeInteger(c.iat) || !Number.isSafeInteger(c.exp)
    || c.iat <= 0 || c.exp <= c.iat || c.exp - c.iat > MAX_TTL) {
    return invalid("invalid_session_claims");
  }
  if (c.iat > nowSeconds + FUTURE_SKEW) return invalid("session_issued_in_future");
  if (c.exp <= nowSeconds) return invalid("session_expired");
  return Object.freeze({ valid: true, session: Object.freeze({
    sessionId: c.sid, scope: c.scope, issuedAt: c.iat, expiresAt: c.exp,
  }) });
}
