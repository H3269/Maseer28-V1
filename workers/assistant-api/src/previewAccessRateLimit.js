const INTERNAL_URL = "https://assistant-preview-access-rate.internal";
const CLIENT_KEY_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const WINDOW_SECONDS = 15 * 60;
const MAX_ATTEMPTS = 5;
const CLEANUP_SECONDS = 24 * 60 * 60;

function strongSecret(value) {
  return typeof value === "string" && new TextEncoder().encode(value).byteLength >= 32;
}

async function digestClientAddress(address, secret, cryptoImpl) {
  if (typeof address !== "string" || address.length < 3 || address.length > 128) {
    throw new TypeError("preview_client_address_unavailable");
  }
  const key = await cryptoImpl.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await cryptoImpl.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(address),
  );
  let binary = "";
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function createPreviewAccessRateLimiter(namespace, secret, cryptoImpl = globalThis.crypto) {
  return Object.freeze({
    async consume(clientAddress, nowSeconds = Math.floor(Date.now() / 1000)) {
      if (!strongSecret(secret) || !cryptoImpl?.subtle
        || !Number.isSafeInteger(nowSeconds) || nowSeconds <= 0
        || !namespace || typeof namespace.idFromName !== "function"
        || typeof namespace.get !== "function") {
        return Object.freeze({ allowed: false, reason: "preview_access_rate_limit_unavailable" });
      }
      let clientKey;
      try {
        clientKey = await digestClientAddress(clientAddress, secret, cryptoImpl);
      } catch {
        return Object.freeze({ allowed: false, reason: "preview_access_rate_limit_unavailable" });
      }
      const stub = namespace.get(namespace.idFromName("assistant-preview-access-global-v1"));
      if (!stub || typeof stub.fetch !== "function") {
        return Object.freeze({ allowed: false, reason: "preview_access_rate_limit_unavailable" });
      }
      try {
        const response = await stub.fetch(`${INTERNAL_URL}/consume`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientKey, nowSeconds }),
        });
        const result = await response.json();
        if (!response.ok || typeof result?.allowed !== "boolean") {
          return Object.freeze({ allowed: false, reason: "preview_access_rate_limit_unavailable" });
        }
        return Object.freeze(result);
      } catch {
        return Object.freeze({ allowed: false, reason: "preview_access_rate_limit_unavailable" });
      }
    },
  });
}

/** Shared Preview-only limiter. It stores keyed address digests, never raw IPs. */
export class AssistantPreviewAccessRateLimitDurableObject {
  constructor(ctx) {
    this.ctx = ctx;
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS preview_access_attempt (
        client_key TEXT PRIMARY KEY CHECK(length(client_key) = 43),
        window_started_at INTEGER NOT NULL,
        attempt_count INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL
      );
    `);
  }

  async fetch(request) {
    if (request.method !== "POST" || new URL(request.url).pathname !== "/consume") {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    let input;
    try {
      const raw = await request.text();
      if (raw.length > 512) return Response.json({ error: "request_too_large" }, { status: 413 });
      input = JSON.parse(raw);
    } catch {
      return Response.json({ error: "invalid_json" }, { status: 400 });
    }
    if (!input || typeof input !== "object" || Array.isArray(input)
      || !CLIENT_KEY_PATTERN.test(input.clientKey ?? "")
      || !Number.isSafeInteger(input.nowSeconds) || input.nowSeconds <= 0) {
      return Response.json({ error: "invalid_rate_limit_request" }, { status: 400 });
    }

    try {
      const result = this.ctx.storage.transactionSync(() => {
        const now = input.nowSeconds;
        const row = this.sql.exec(
          "SELECT window_started_at, attempt_count FROM preview_access_attempt WHERE client_key = ?",
          input.clientKey,
        ).toArray()[0];
        let startedAt = row?.window_started_at ?? now;
        let count = row?.attempt_count ?? 0;
        if (now >= startedAt + WINDOW_SECONDS || now < startedAt) {
          startedAt = now;
          count = 0;
        }
        if (count >= MAX_ATTEMPTS) {
          this.sql.exec(
            "UPDATE preview_access_attempt SET last_seen_at = ? WHERE client_key = ?",
            now, input.clientKey,
          );
          return { allowed: false, reason: "preview_access_rate_limited", retryAfterSeconds: Math.max(1, startedAt + WINDOW_SECONDS - now) };
        }
        count += 1;
        this.sql.exec(
          `INSERT INTO preview_access_attempt (client_key, window_started_at, attempt_count, last_seen_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(client_key) DO UPDATE SET
             window_started_at = excluded.window_started_at,
             attempt_count = excluded.attempt_count,
             last_seen_at = excluded.last_seen_at`,
          input.clientKey, startedAt, count, now,
        );
        return { allowed: true, remaining: MAX_ATTEMPTS - count };
      });
      await this.ctx.storage.setAlarm((input.nowSeconds + CLEANUP_SECONDS) * 1000);
      return Response.json(result);
    } catch {
      return Response.json({ error: "preview_access_rate_limit_unavailable" }, { status: 503 });
    }
  }

  async alarm() {
    const cutoff = Math.floor(Date.now() / 1000) - CLEANUP_SECONDS;
    this.sql.exec("DELETE FROM preview_access_attempt WHERE last_seen_at <= ?", cutoff);
    await this.ctx.storage.deleteAlarm();
  }
}
