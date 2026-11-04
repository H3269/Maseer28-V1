import test from "node:test";
import assert from "node:assert/strict";
import { createWorkersAiStructuredGenerator } from "../workers/assistant-api/src/workersAiProvider.js";

const schema = {
  type: "object",
  properties: { label: { type: "string" } },
  required: ["label"],
  additionalProperties: false,
};
const messages = [
  { role: "system", content: "Return structured output only." },
  { role: "user", content: "سلام" },
];

test("requires an AI binding and a trusted Cloudflare model identifier", () => {
  assert.throws(() => createWorkersAiStructuredGenerator({
    model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  }), /workers_ai_binding_unavailable/);
  assert.throws(() => createWorkersAiStructuredGenerator({
    ai: { run: async () => ({ response: {} }) },
    model: "https://attacker.invalid/model",
  }), /invalid_workers_ai_model/);
  assert.throws(() => createWorkersAiStructuredGenerator({
    ai: { run: async () => ({ response: {} }) },
    model: "@cf/qwen/qwen3-30b-a3b-fp8",
  }), /unsupported_workers_ai_json_model/);
});

test("uses Workers AI JSON Schema mode with bounded generation settings", async () => {
  let captured;
  const generate = createWorkersAiStructuredGenerator({
    ai: {
      run: async (model, input) => {
        captured = { model, input };
        return { response: { label: "ok" } };
      },
    },
    model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  });

  const result = await generate({
    messages,
    responseSchema: schema,
    maxTokens: 512,
    temperature: 0.2,
  });

  assert.deepEqual(result, { label: "ok" });
  assert.equal(captured.model, "@cf/meta/llama-3.3-70b-instruct-fp8-fast");
  assert.deepEqual(captured.input.messages, messages);
  assert.deepEqual(captured.input.response_format, {
    type: "json_schema",
    json_schema: schema,
  });
  assert.equal(captured.input.max_tokens, 512);
  assert.equal(captured.input.temperature, 0.2);
});

test("parses bounded JSON text response and rejects malformed or oversized output", async () => {
  const generate = createWorkersAiStructuredGenerator({
    ai: { run: async () => ({ response: '{"label":"parsed"}' }) },
    model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  });
  assert.deepEqual(await generate({ messages, responseSchema: schema }), { label: "parsed" });

  const malformed = createWorkersAiStructuredGenerator({
    ai: { run: async () => ({ response: "{not-json" }) },
    model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  });
  await assert.rejects(() => malformed({ messages, responseSchema: schema }), /invalid_json/);

  const oversized = createWorkersAiStructuredGenerator({
    ai: { run: async () => ({ response: "x".repeat(16_385) }) },
    model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  });
  await assert.rejects(() => oversized({ messages, responseSchema: schema }), /invalid_structured_response/);
});

test("rejects malformed generation input before calling the AI binding", async () => {
  let calls = 0;
  const generate = createWorkersAiStructuredGenerator({
    ai: { run: async () => { calls += 1; return { response: { label: "ok" } }; } },
    model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  });
  await assert.rejects(() => generate({
    messages: [{ role: "tool", content: "not allowed" }],
    responseSchema: schema,
  }), /invalid_workers_ai_request/);
  await assert.rejects(() => generate({
    messages,
    responseSchema: schema,
    maxTokens: 2048,
  }), /invalid_workers_ai_request/);
  assert.equal(calls, 0);
});

test("propagates provider failures for the orchestration layer to sanitize", async () => {
  const generate = createWorkersAiStructuredGenerator({
    ai: { run: async () => { throw new Error("provider-internal-error"); } },
    model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  });
  await assert.rejects(
    () => generate({ messages, responseSchema: schema }),
    /provider-internal-error/,
  );
});
