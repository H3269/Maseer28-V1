import test from "node:test";
import assert from "node:assert/strict";
import {
  createReplayMarkerConsumer,
  ReplayMarkerDurableObject,
} from "../workers/assistant-api/src/replayMarkerDurableObject.js";

const shardName = "v1:ab";
const fingerprint = "a".repeat(64);
const expiresAt = Date.now() + 60_000;

function namespaceWith(stubFetch) {
  const calls = [];
  return {
    calls,
    namespace: {
      idFromName(name) {
        calls.push(["idFromName", name]);
        return { id: name };
      },
      get(id) {
        calls.push(["get", id]);
        return { fetch: stubFetch };
      },
    },
  };
}

test("namespace adapter routes a validated replay request to its deterministic shard", async () => {
  const harness = namespaceWith(async (url, init) => {
    harness.calls.push(["fetch", url, init]);
    return Response.json({ consumed: true });
  });
  const consume = createReplayMarkerConsumer(harness.namespace);

  assert.equal(await consume({ shardName, fingerprint, expiresAt }), true);
  assert.equal(harness.calls[0][0], "idFromName");
  assert.equal(harness.calls[0][1], shardName);
  assert.deepEqual(harness.calls[1], ["get", { id: shardName }]);
  const [, url, init] = harness.calls[2];
  assert.equal(url, "https://replay-marker.internal/consume");
  assert.equal(init.method, "POST");
  assert.deepEqual(JSON.parse(init.body), { fingerprint, expiresAt });
});

test("namespace adapter preserves duplicate result as false", async () => {
  const harness = namespaceWith(async () => Response.json({ consumed: false }));
  const consume = createReplayMarkerConsumer(harness.namespace);
  assert.equal(await consume({ shardName, fingerprint, expiresAt }), false);
});

test("namespace adapter rejects malformed shard names and request values before routing", async () => {
  const harness = namespaceWith(async () => Response.json({ consumed: true }));
  const consume = createReplayMarkerConsumer(harness.namespace);

  for (const input of [
    { shardName: "v1:xyz", fingerprint, expiresAt },
    { shardName: "v1:ab", fingerprint: "not-a-fingerprint", expiresAt },
    { shardName: "v1:ab", fingerprint, expiresAt: Number.NaN },
  ]) {
    await assert.rejects(() => consume(input), /invalid_replay_marker_request/);
  }
  assert.equal(harness.calls.length, 0);
});

test("namespace adapter fails closed on storage, HTTP, and malformed response failures", async () => {
  const unavailable = namespaceWith(async () => new Response(null, { status: 503 }));
  await assert.rejects(
    () => createReplayMarkerConsumer(unavailable.namespace)({ shardName, fingerprint, expiresAt }),
    /replay_marker_storage_unavailable/,
  );

  const malformed = namespaceWith(async () => new Response("not-json", { status: 200 }));
  await assert.rejects(
    () => createReplayMarkerConsumer(malformed.namespace)({ shardName, fingerprint, expiresAt }),
    /invalid_replay_marker_response/,
  );

  const missingResult = namespaceWith(async () => Response.json({ ok: true }));
  await assert.rejects(
    () => createReplayMarkerConsumer(missingResult.namespace)({ shardName, fingerprint, expiresAt }),
    /invalid_replay_marker_response/,
  );
});

test("Durable Object endpoint accepts only POST /consume with valid JSON", async () => {
  const calls = [];
  const fakeShard = {
    async consumeOnce(input) {
      calls.push(input);
      return true;
    },
    async alarm() {
      calls.push("alarm");
    },
  };
  const instance = Object.create(ReplayMarkerDurableObject.prototype);
  instance.shard = fakeShard;

  assert.equal((await instance.fetch(new Request("https://do.invalid/consume"))).status, 405);
  assert.equal((await instance.fetch(new Request("https://do.invalid/private"))).status, 404);
  assert.equal((await instance.fetch(new Request("https://do.invalid/consume", {
    method: "POST",
    body: "{",
  }))).status, 400);
  assert.equal((await instance.fetch(new Request("https://do.invalid/consume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fingerprint: "bad", expiresAt }),
  }))).status, 400);

  const response = await instance.fetch(new Request("https://do.invalid/consume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fingerprint, expiresAt }),
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { consumed: true });
  assert.deepEqual(calls, [{ fingerprint, expiresAt }]);

  await instance.alarm();
  assert.equal(calls[1], "alarm");
});
