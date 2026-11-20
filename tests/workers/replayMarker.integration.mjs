import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const baseUrl = "http://127.0.0.1:8788";
const REQUEST_TIMEOUT_MS = 10_000;
const child = spawn(
  "npx",
  [
    "--yes",
    "wrangler@4.157.0",
    "dev",
    "--local",
    "--config",
    "tests/workers/replay-marker.wrangler.toml",
    "--ip",
    "127.0.0.1",
    "--port",
    "8788",
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

async function request(path, body = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await response.text();
  assert.equal(response.ok, true, `HTTP ${response.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function waitForServer() {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (spawnError) throw new Error(`Could not start Wrangler: ${spawnError.message}`);
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`Wrangler exited early (${child.exitCode ?? child.signalCode}): ${serverOutput}`);
    }
    try {
      const response = await fetch(`${baseUrl}/state`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
        signal: AbortSignal.timeout(2_000),
      });
      if (response.ok) {
        await response.arrayBuffer();
        return;
      }
      serverOutput += `\nReadiness probe returned HTTP ${response.status}`;
    } catch (error) {
      if (error?.name === "TimeoutError" || error?.name === "AbortError") {
        serverOutput += "\nReadiness probe timed out";
      }
      // Connection refusal is expected while workerd starts.
    }
    await delay(500);
  }
  throw new Error(`Wrangler did not become ready within 45 seconds: ${serverOutput}`);
}

function signalProcessGroup(signal) {
  if (!child.pid) return;
  try {
    // npx starts Wrangler and workerd descendants. Signal the detached group.
    process.kill(-child.pid, signal);
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
}

try {
  await waitForServer();

  stage = "concurrent replay-marker requests";
  const fingerprint = "a".repeat(64);
  const expiresAt = Date.now() + 180_000;
  const duplicateResults = await Promise.all(
    Array.from({ length: 12 }, () =>
      request("/consume", { fingerprint, expiresAt }),
    ),
  );
  assert.equal(
    duplicateResults.filter((result) => result.consumed).length,
    1,
    "exactly one concurrent request must consume a fingerprint",
  );

  stage = "distinct fingerprint and Alarm state";
  const second = await request("/consume", {
    fingerprint: "b".repeat(64),
    expiresAt: expiresAt + 60_000,
  });
  assert.equal(second.consumed, true);

  const stateBeforeCleanup = await request("/state");
  assert.equal(stateBeforeCleanup.count, 2);
  assert.ok(Number.isFinite(stateBeforeCleanup.alarmAt));
  assert.ok(stateBeforeCleanup.alarmAt <= expiresAt);

  stage = "expired marker cleanup";
  const cleaned = await request("/expire-and-alarm");
  assert.equal(cleaned.count, 0);
  assert.equal(cleaned.alarmAt, null);

  console.log("Cloudflare Workers runtime integration passed: SQLite transaction, concurrent consume-once, Alarm scheduling and cleanup.");
} catch (error) {
  console.error(`Integration test failed during: ${stage}`);
  console.error(error);
  console.error(serverOutput);
  process.exitCode = 1;
} finally {
  signalProcessGroup("SIGTERM");
  await delay(500);
  signalProcessGroup("SIGKILL");
  try { child.kill("SIGKILL"); } catch {}
  // Descendants can inherit Wrangler's stdout/stderr and keep Node alive even
  // after the npm shim exits. Close our pipe ends so the test process finishes.
  child.stdout?.destroy();
  child.stderr?.destroy();
  await Promise.race([childClosed, delay(1_000)]);
}
