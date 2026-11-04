import { runSemanticConversationTurn } from "../../workers/assistant-api/src/semanticConversation.js";
import { createWorkersAiStructuredGenerator } from "../../workers/assistant-api/src/workersAiProvider.js";

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Local-only harness. The mock generator is supplied by the test request and
 * must never be wired into the production Worker or a public endpoint.
 */
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ status: "ok" });
    }
    if (request.method !== "POST" || url.pathname !== "/turn") {
      return json({ error: "not_found" }, 404);
    }

    let input;
    try {
      input = await request.json();
    } catch {
      return json({ error: "invalid_json" }, 400);
    }
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return json({ error: "invalid_request" }, 400);
    }

    const result = await runSemanticConversationTurn({
      message: input.message,
      history: input.history,
      // Test-only fixture: production must inject the result of a server-side
      // consent lookup and must never trust consent fields from the client.
      consentVerified: input.testConsent === "verified"
        ? {
          cloudAiProcessing: true,
          sensitiveDataProcessing: true,
          policyVersion: "test-consent-v1",
        }
        : {
          cloudAiProcessing: true,
          sensitiveDataProcessing: false,
          policyVersion: "test-consent-v1",
        },
      generateStructuredTurn: createWorkersAiStructuredGenerator({
        model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        ai: {
          run: async () => ({ response: input.mockOutput }),
        },
      }),
    });
    return json(result, result.ok ? 200 : result.status);
  },
};
