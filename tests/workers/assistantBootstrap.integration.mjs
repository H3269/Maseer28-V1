import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { verifyAssistantSessionToken } from "../../workers/assistant-api/src/sessionToken.js";

const BASE_URL = "http://127.0.0.1:8789";
const BOT_TOKEN = "test-only-telegram-bot-token-not-a-secret";
const SESSION_SECRET = "test-only-session-signing-secret-32-bytes";
const REQUEST_TIMEOUT_MS = 10_000;
const child = spawn(
  "npx",
  [
    "--yes",
    "wrangler@4.157.0",
    "dev",
    "--local",
    "--config",
    "tests/workers/assistant-bootstrap.wrangler.toml",
    "--ip",
    "127.0.0.1",
    "--port",
    "8789",
    "--log-level",
    "error",
  ],
  { stdio: ["ignore", "pipe", "pipe"], detached: true },
);

let serverOutput = "";
let spawnError = null;
let stage = "starting Wrangler";
const childClosed = new Promise((resolve) => child.once("close", resolve));
child.on("error", (error) => { spawnError = error; });
child.stdout.setEncoding("utf8").on("data", (chunk) => { serverOutput += chunk; });
child.stderr.setEncoding("utf8").on("data", (chunk) => { serverOutput += chunk; });

async function hmac(keyBytes, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  ));
}

function toHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function makeTelegramInitData({ authDate, queryId }) {
  const fields = new URLSearchParams({
    auth_date: String(authDate),
    query_id: queryId,
    user: JSON.stringify({ id: 987654321, first_name: "Integration Fixture" }),
  });
  const platformSecret = await hmac(
    new TextEncoder().encode("WebAppData"),
    BOT_TOKEN,
  );
  const checkString = [...fields.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  fields.set("hash", toHex(await hmac(platformSecret, checkString)));
  return fields.toString();
}

async function post(initData) {
  const response = await fetch(`${BASE_URL}/bootstrap`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ platform: "telegram", initData }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  return { status: response.status, body: await response.json() };
}

async function waitForServer() {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (spawnError) throw new Error(`Could not start Wrangler: ${spawnError.message}`);
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`Wrangler exited early (${child.exitCode ?? child.signalCode}): ${serverOutput}`);
    }
    try {
      const response = await fetch(`${BASE_URL}/health`, {
        signal: AbortSignal.timeout(2_000),
      });
      if (response.ok) {
        await response.arrayBuffer();
        return;
      }
    } catch {
      // Connection refusal is expected while workerd starts.
    }
    await delay(500);
  }
  throw new Error(`Wrangler did not become ready within 45 seconds: ${serverOutput}`);
}

function signalProcessGroup(signal) {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
}

try {
  await waitForServer();
  const now = Math.floor(Date.now() / 1000);
  const initData = await makeTelegramInitData({
    authDate: now,
    queryId: "assistant-bootstrap-concurrency-fixture",
  });

  stage = "concurrent end-to-end bootstrap and anti-replay";
  const concurrent = await Promise.all(
    Array.from({ length: 12 }, () => post(initData)),
  );
  const winners = concurrent.filter((result) => result.status === 200);
  const duplicates = concurrent.filter((result) => result.status === 409);
  assert.equal(winners.length, 1, "exactly one concurrent bootstrap may issue a token");
  assert.equal(duplicates.length, 11, "all other concurrent bootstraps must be rejected");
  assert.equal(winners[0].body.ok, true);
  assert.equal(winners[0].body.tokenType, "Bearer");
  assert.equal(winners[0].body.expiresInSeconds, 600);
  assert.equal(
    duplicates.every((result) => result.body.error === "init_data_replayed"
      && !("token" in result.body)),
    true,
    "duplicate responses must never expose a prepared token",
  );

  stage = "verify issued session token";
  const verified = await verifyAssistantSessionToken({
    token: winners[0].body.token,
    secret: SESSION_SECRET,
    nowSeconds: now + 1,
  });
  assert.equal(verified.valid, true);
  assert.equal(verified.session.scope, "assistant:turn");
  assert.equal("userId" in verified.session, false);

  stage = "reject invalid platform signature";
  const invalidSignature = new URLSearchParams(initData);
  invalidSignature.set("hash", "0".repeat(64));
  const rejectedSignature = await post(invalidSignature.toString());
  assert.equal(rejectedSignature.status, 401);
  assert.equal(rejectedSignature.body.error, "platform_auth_failed");

  stage = "reject expired platform data";
  const expiredData = await makeTelegramInitData({
    authDate: now - 301,
    queryId: "assistant-bootstrap-expired-fixture",
  });
  const rejectedExpired = await post(expiredData);
  assert.equal(rejectedExpired.status, 401);
  assert.equal(rejectedExpired.body.error, "platform_auth_failed");

  stage = "allow a distinct signed initData";
  const distinctData = await makeTelegramInitData({
    authDate: now,
    queryId: "assistant-bootstrap-distinct-fixture",
  });
  const distinct = await post(distinctData);
  assert.equal(distinct.status, 200);
  assert.equal(distinct.body.ok, true);

  console.log("Assistant bootstrap integration passed: real Telegram HMAC verification, local SQLite Durable Object anti-replay under concurrency, signed session issuance, duplicate rejection, and fail-closed invalid/expired input.");
} catch (error) {
  console.error(`Assistant bootstrap integration failed during: ${stage}`);
  console.error(error);
  console.error(serverOutput);
  process.exitCode = 1;
} finally {
  signalProcessGroup("SIGTERM");
  await delay(500);
  signalProcessGroup("SIGKILL");
  try { child.kill("SIGKILL"); } catch {}
  child.stdout?.destroy();
  child.stderr?.destroy();
  await Promise.race([childClosed, delay(1_000)]);
}
