import { runSemanticConversationTurn } from "../../workers/assistant-api/src/semanticConversation.js";
import { createWorkersAiStructuredGenerator } from "../../workers/assistant-api/src/workersAiProvider.js";
import {
  createAssistantPreviewSession,
  verifyAssistantPreviewSession,
} from "../../workers/assistant-api/src/previewSession.js";

const TEST_ENV = Object.freeze({
  ASSISTANT_PREVIEW_ENABLED: "true",
  ASSISTANT_PREVIEW_ACCESS_CODE: "local-preview-access-code-32-bytes-minimum",
  PREVIEW_SESSION_SIGNING_SECRET: "local-preview-session-signing-secret-32-bytes",
  ASSISTANT_CONSENT_POLICY_VERSION: "test-consent-v1",
});

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

async function readInput(request) {
  try {
    const input = await request.json();
    return input && typeof input === "object" && !Array.isArray(input) ? input : null;
  } catch {
    return null;
  }
}

/**
 * Local-only harness. The access code, signing secret, and mock AI binding are
 * synthetic fixtures and must never be wired into the production Worker.
 */
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ status: "ok" });
    }
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

    if (url.pathname === "/session") {
      const input = await readInput(request);
      if (!input) return json({ error: "invalid_request" }, 400);
      const result = await createAssistantPreviewSession({
        accessCode: input.accessCode,
        consent: input.consent,
        env: TEST_ENV,
      });
      return json(result, result.ok ? 200 : result.status);
    }

    if (url.pathname !== "/turn") return json({ error: "not_found" }, 404);
    const input = await readInput(request);
    if (!input) return json({ error: "invalid_request" }, 400);

    const authorization = request.headers.get("Authorization") || "";
    const match = authorization.match(/^Bearer (.+)$/);
    const verified = await verifyAssistantPreviewSession({
      token: match?.[1],
      env: TEST_ENV,
    });
    if (!verified.valid) return json({ error: "invalid_preview_session" }, 401);

    const result = await runSemanticConversationTurn({
      message: input.message,
      history: input.history,
      consentVerified: verified.consentVerified,
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
