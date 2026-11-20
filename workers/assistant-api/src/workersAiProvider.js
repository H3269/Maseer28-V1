const JSON_MODELS_SUPPORTED_BY_WORKERS_AI = new Set([
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "@cf/meta/llama-3.1-8b-instruct",
  "@cf/meta/llama-3-8b-instruct",
  "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Provider adapter for Cloudflare Workers AI JSON Mode.
 * It is deliberately not wired to the production Worker or an AI binding yet.
 */
export function createWorkersAiStructuredGenerator({ ai, model } = {}) {
  if (!ai || typeof ai.run !== "function") {
    throw new TypeError("workers_ai_binding_unavailable");
  }
  if (typeof model !== "string" || !/^@cf\/[a-z0-9._/-]{3,160}$/i.test(model)) {
    throw new TypeError("invalid_workers_ai_model");
  }
  if (!JSON_MODELS_SUPPORTED_BY_WORKERS_AI.has(model)) {
    throw new TypeError("unsupported_workers_ai_json_model");
  }

  return async ({
    messages,
    responseSchema,
    maxTokens = 512,
    temperature = 0.2,
  } = {}) => {
    if (!Array.isArray(messages) || messages.length === 0
      || !messages.every((item) => isRecord(item)
        && ["system", "user", "assistant"].includes(item.role)
        && typeof item.content === "string")
      || !isRecord(responseSchema)
      || !Number.isSafeInteger(maxTokens) || maxTokens < 1 || maxTokens > 1024
      || typeof temperature !== "number" || temperature < 0 || temperature > 1) {
      throw new TypeError("invalid_workers_ai_request");
    }

    const result = await ai.run(model, {
      messages,
      response_format: {
        type: "json_schema",
        json_schema: responseSchema,
      },
      max_tokens: maxTokens,
      temperature,
    });

    const payload = result?.response;
    if (isRecord(payload)) return payload;
    if (typeof payload === "string" && payload.length > 0 && payload.length <= 16_384) {
      let parsed;
      try {
        parsed = JSON.parse(payload);
      } catch {
        throw new Error("workers_ai_invalid_json_response");
      }
      if (isRecord(parsed)) return parsed;
    }
    throw new Error("workers_ai_invalid_structured_response");
  };
}
