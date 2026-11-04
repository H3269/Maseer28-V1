import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const BASE_URL = "http://127.0.0.1:8790";
const REQUEST_TIMEOUT_MS = 10_000;
const child = spawn(
  "npx",
  [
    "--yes",
    "wrangler@4.157.0",
    "dev",
    "--local",
    "--config",
    "tests/workers/semantic-conversation.wrangler.toml",
    "--ip",
    "127.0.0.1",
    "--port",
    "8790",
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

async function post(input) {
  const response = await fetch(`${BASE_URL}/turn`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
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

const validOutput = {
  intent: "personal_experience",
  summary: "در موقعیت‌های کاری از قضاوت دیگران نگرانی.",
  topic_candidates: ["T27"],
  needs_clarification: false,
  clarifying_question: "",
  risk_signal: "none",
  out_of_scope: false,
};

try {
  await waitForServer();

  stage = "semantic topic confirmation with bounded context";
  const routed = await post({
    consentVerified: true,
    message: "در محل کار از قضاوت دیگران می‌ترسم.",
    history: [
      { role: "user", content: "وقتی در جلسه حرف می‌زنم مضطرب می‌شوم." },
      { role: "assistant", content: "در چه موقعیتی بیشتر این اتفاق می‌افتد؟" },
    ],
    mockOutput: validOutput,
  });
  assert.equal(routed.status, 200);
  assert.equal(routed.body.status, "topic_confirmation_required");
  assert.equal(routed.body.topic_candidates[0].topic_id, "T27");

  stage = "multi-topic clarification";
  const ambiguous = await post({
    consentVerified: true,
    message: "هم عصبانی‌ام و هم می‌ترسم.",
    mockOutput: {
      ...validOutput,
      topic_candidates: ["T01", "T03"],
      needs_clarification: true,
      clarifying_question: "کدام موضوع در موقعیت اخیر برایت پررنگ‌تر بود؟",
    },
  });
  assert.equal(ambiguous.status, 200);
  assert.equal(ambiguous.body.status, "clarification_required");
  assert.equal(ambiguous.body.topic_candidates.length, 2);

  stage = "independent safety precedence";
  const safety = await post({
    consentVerified: true,
    message: "امشب قصد دارم خودم را بکشم.",
    mockOutput: validOutput,
  });
  assert.equal(safety.status, 200);
  assert.equal(safety.body.status, "urgent_human_support_required");
  assert.equal(safety.body.model_called, false);

  stage = "server-side consent requirement";
  const noConsent = await post({
    consentVerified: false,
    message: "در محل کار نگرانم.",
    mockOutput: validOutput,
  });
  assert.equal(noConsent.status, 403);
  assert.equal(noConsent.body.error, "cloud_consent_required");

  stage = "no unapproved general knowledge";
  const general = await post({
    consentVerified: true,
    message: "اضطراب چیست؟",
    mockOutput: {
      ...validOutput,
      intent: "general_information",
      summary: "کاربر تعریف اضطراب را می‌خواهد.",
      topic_candidates: ["T02"],
    },
  });
  assert.equal(general.status, 200);
  assert.equal(general.body.status, "knowledge_unavailable");
  assert.equal(general.body.topic_candidates.length, 0);

  stage = "reject malformed model output";
  const malformed = await post({
    consentVerified: true,
    message: "می‌خواهم درباره تجربه‌ام صحبت کنم.",
    mockOutput: { ...validOutput, topic_candidates: ["T99"] },
  });
  assert.equal(malformed.status, 502);
  assert.equal(malformed.body.error, "assistant_model_output_invalid");

  console.log("Semantic conversation runtime integration passed: Worker module loading, consent gate, independent safety precedence, topic confirmation, ambiguity handling, and rejection of unapproved knowledge/malformed output.");
} catch (error) {
  console.error(`Semantic conversation integration failed during: ${stage}`);
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
