const INTERNAL_URL = "https://assistant-preview-session-guard.internal";
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{32}$/;
const MAX_REQUESTS_PER_WINDOW = 20;
const RATE_WINDOW_SECONDS = 5 * 60;

function validSessionInput(input) {
  return input && typeof input === "object" && !Array.isArray(input)
    && SESSION_ID_PATTERN.test(input.sessionId ?? "")
    && Number.isSafeInteger(input.expiresAt)
    && input.expiresAt > 0
    && typeof input.policyVersion === "string"
    && input.policyVersion.length > 0
    && input.policyVersion.length <= 64;
}

async function callGuard(namespace, sessionId, path, payload) {
  if (!namespace || typeof namespace.idFromName !== "function"
    || typeof namespace.get !== "function"
    || !SESSION_ID_PATTERN.test(sessionId ?? "")) {
    throw new TypeError("preview_session_guard_unavailable");
  }
  const id = namespace.idFromName(sessionId);
  const stub = namespace.get(id);
  if (!stub || typeof stub.fetch !== "function") {
    throw new TypeError("preview_session_guard_unavailable");
  }
  const response = await stub.fetch(`${INTERNAL_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("preview_session_guard_invalid_response");
  }
  if (!response.ok) throw new Error(result?.error || "preview_session_guard_unavailable");
  return result;
}

/** Creates server-only operations backed by one Durable Object per session. */
export function createPreviewSessionGuard(namespace) {
  return Object.freeze({
    async create({ sessionId, expiresAt, policyVersion, nowSeconds }) {
      return callGuard(namespace, sessionId, "/create", {
        sessionId, expiresAt, policyVersion, nowSeconds,
      });
    },
    async authorize({ sessionId, expiresAt, policyVersion, nowSeconds }) {
      return callGuard(namespace, sessionId, "/authorize", {
        sessionId, expiresAt, policyVersion, nowSeconds,
      });
    },
    async revoke({ sessionId, nowSeconds }) {
      return callGuard(namespace, sessionId, "/revoke", { sessionId, nowSeconds });
    },
  });
}

/**
 * Private Durable Object: its namespace is never exposed as an HTTP route.
 * A session has an independent object, atomic five-minute request window,
 * immediate revocation, and alarm-based expiry cleanup.
 */
export class AssistantPreviewSessionGuardDurableObject {
  constructor(ctx) {
    this.ctx = ctx;
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS preview_session (
        session_id TEXT PRIMARY KEY CHECK(length(session_id) = 32),
        expires_at INTEGER NOT NULL,
        policy_version TEXT NOT NULL,
        revoked_at INTEGER,
        window_started_at INTEGER NOT NULL,
        request_count INTEGER NOT NULL
      );
    `);
  }

  async fetch(request) {
    if (request.method !== "POST") {
      return Response.json({ error: "method_not_allowed" }, { status: 405 });
    }
    const path = new URL(request.url).pathname;
    if (!["/create", "/authorize", "/revoke"].includes(path)) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    let input;
    try {
      const raw = await request.text();
      if (raw.length > 2048) return Response.json({ error: "request_too_large" }, { status: 413 });
      input = JSON.parse(raw);
    } catch {
      return Response.json({ error: "invalid_json" }, { status: 400 });
    }
    const validBase = input && typeof input === "object" && !Array.isArray(input)
      && SESSION_ID_PATTERN.test(input.sessionId ?? "");
    const validAction = path === "/revoke"
      ? (input.nowSeconds === undefined || Number.isSafeInteger(input.nowSeconds))
      : (validSessionInput(input) && Number.isSafeInteger(input.nowSeconds));
    if (!validBase || !validAction) {
      return Response.json({ error: "invalid_session_guard_request" }, { status: 400 });
    }

    try {
      if (path === "/create") return await this.#create(input);
      if (path === "/authorize") return this.#authorize(input);
      return this.#revoke(input);
    } catch {
      return Response.json({ error: "preview_session_guard_unavailable" }, { status: 503 });
    }
  }

  async #create(input) {
    const now = input.nowSeconds;
    if (input.expiresAt <= now || input.expiresAt - now > 900) {
      return Response.json({ error: "invalid_session_expiry" }, { status: 400 });
    }
    this.ctx.storage.transactionSync(() => {
      this.sql.exec(
        `INSERT INTO preview_session
         (session_id, expires_at, policy_version, revoked_at, window_started_at, request_count)
         VALUES (?, ?, ?, NULL, ?, 0)`,
        input.sessionId, input.expiresAt, input.policyVersion, now,
      );
    });
    try {
      await this.ctx.storage.setAlarm(input.expiresAt * 1000);
    } catch {
      this.sql.exec("DELETE FROM preview_session WHERE session_id = ?", input.sessionId);
      return Response.json({ error: "preview_session_guard_unavailable" }, { status: 503 });
    }
    return Response.json({ created: true });
  }

  #authorize(input) {
    const result = this.ctx.storage.transactionSync(() => {
      const row = this.sql.exec(
        "SELECT expires_at, policy_version, revoked_at, window_started_at, request_count FROM preview_session WHERE session_id = ?",
        input.sessionId,
      ).toArray()[0];
      if (!row) return { allowed: false, reason: "preview_session_unknown" };
      if (row.revoked_at !== null) return { allowed: false, reason: "preview_session_revoked" };
      if (row.expires_at <= input.nowSeconds || row.expires_at !== input.expiresAt) {
        return { allowed: false, reason: "preview_session_expired" };
      }
      if (row.policy_version !== input.policyVersion) {
        return { allowed: false, reason: "preview_session_policy_changed" };
      }
      let windowStartedAt = row.window_started_at;
      let requestCount = row.request_count;
      if (input.nowSeconds >= windowStartedAt + RATE_WINDOW_SECONDS) {
        windowStartedAt = input.nowSeconds;
        requestCount = 0;
      }
      if (requestCount >= MAX_REQUESTS_PER_WINDOW) {
        return { allowed: false, reason: "preview_session_rate_limited" };
      }
      this.sql.exec(
        "UPDATE preview_session SET window_started_at = ?, request_count = ? WHERE session_id = ?",
        windowStartedAt, requestCount + 1, input.sessionId,
      );
      return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - requestCount - 1 };
    });
    return Response.json(result, { status: 200 });
  }

  #revoke(input) {
    const changed = this.ctx.storage.transactionSync(() => {
      const row = this.sql.exec(
        "SELECT revoked_at FROM preview_session WHERE session_id = ?",
        input.sessionId,
      ).toArray()[0];
      if (!row || row.revoked_at !== null) return false;
      this.sql.exec(
        "UPDATE preview_session SET revoked_at = ? WHERE session_id = ?",
        Number.isSafeInteger(input.nowSeconds) ? input.nowSeconds : Math.floor(Date.now() / 1000),
        input.sessionId,
      );
      return true;
    });
    return Response.json({ revoked: changed });
  }

  async alarm() {
    this.sql.exec("DELETE FROM preview_session WHERE expires_at <= ?", Math.floor(Date.now() / 1000));
    await this.ctx.storage.deleteAlarm();
  }
}
