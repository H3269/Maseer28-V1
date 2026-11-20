import {
  createReplayMarkerConsumer,
  ReplayMarkerDurableObject,
} from "../../workers/assistant-api/src/replayMarkerDurableObject.js";
import { bootstrapAssistantSession } from "../../workers/assistant-api/src/sessionBootstrap.js";

export class ReplayMarkerBootstrapTestDO extends ReplayMarkerDurableObject {}

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
 * Local-only integration harness. It is not imported by the production Worker
 * and uses test-only credentials from its dedicated Wrangler configuration.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ status: "ok" });
    }
    if (request.method !== "POST" || url.pathname !== "/bootstrap") {
      return json({ error: "not_found" }, 404);
    }

    let input;
    try {
      input = await request.json();
    } catch {
      return json({ error: "invalid_json" }, 400);
    }
    if (
      !input
      || typeof input !== "object"
      || Array.isArray(input)
      || !["telegram", "bale"].includes(input.platform)
      || typeof input.initData !== "string"
    ) {
      return json({ error: "invalid_request" }, 400);
    }

    const result = await bootstrapAssistantSession({
      platform: input.platform,
      initData: input.initData,
      env,
      consumeReplayMarker: createReplayMarkerConsumer(env.REPLAY_MARKERS),
    });
    return json(result, result.ok ? 200 : result.status);
  },
};
