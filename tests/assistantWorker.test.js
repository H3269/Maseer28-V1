import test from "node:test";
import assert from "node:assert/strict";
import worker from "../workers/assistant-api/src/index.js";

const env = { ALLOWED_ORIGINS: "https://app.example.test,https://preview.example.test" };

test("health endpoint reports the API is alive but assistant processing is disabled", async () => {
  const response = await worker.fetch(
    new Request("https://worker.example.test/health"),
    env,
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, "ok");
  assert.equal(body.assistantEnabled, false);
  assert.equal(body.providerConfigured, false);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("chat endpoint fails closed without reading or echoing submitted content", async () => {
  const response = await worker.fetch(
    new Request("https://worker.example.test/v1/assistant/turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "PRIVATE TEST MESSAGE" }),
    }),
    env,
  );
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.error, "assistant_not_configured");
  assert.equal(JSON.stringify(body).includes("PRIVATE TEST MESSAGE"), false);
});

test("an explicitly allowed origin receives an exact CORS response", async () => {
  const response = await worker.fetch(
    new Request("https://worker.example.test/health", {
      headers: { Origin: "https://app.example.test" },
    }),
    env,
  );

  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("access-control-allow-origin"),
    "https://app.example.test",
  );
});

test("an unlisted origin is rejected and never receives wildcard CORS", async () => {
  const response = await worker.fetch(
    new Request("https://worker.example.test/health", {
      headers: { Origin: "https://attacker.example.test" },
    }),
    env,
  );

  assert.equal(response.status, 403);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
});

test("preflight is restricted to explicitly allowed origins", async () => {
  const allowed = await worker.fetch(
    new Request("https://worker.example.test/v1/assistant/turn", {
      method: "OPTIONS",
      headers: {
        Origin: "https://app.example.test",
        "Access-Control-Request-Method": "POST",
      },
    }),
    env,
  );
  const denied = await worker.fetch(
    new Request("https://worker.example.test/v1/assistant/turn", {
      method: "OPTIONS",
      headers: { Origin: "https://attacker.example.test" },
    }),
    env,
  );

  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get("access-control-allow-methods"), "GET, POST, OPTIONS");
  assert.equal(denied.status, 403);
});

test("unknown routes and unsupported chat methods are rejected", async () => {
  const missing = await worker.fetch(
    new Request("https://worker.example.test/not-a-route"),
    env,
  );
  const wrongMethod = await worker.fetch(
    new Request("https://worker.example.test/v1/assistant/turn"),
    env,
  );

  assert.equal(missing.status, 404);
  assert.equal(wrongMethod.status, 405);
});
