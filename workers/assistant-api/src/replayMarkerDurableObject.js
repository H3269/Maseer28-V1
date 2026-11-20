import { ReplayMarkerShard } from "./replayMarkerShard.js";

const SHARD_NAME_PATTERN = /^v1:[a-f0-9]{2}$/;
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;
const INTERNAL_CONSUME_URL = "https://replay-marker.internal/consume";

/**
 * Durable Object entry point for one deterministic replay-marker shard.
 * The namespace binding is private to the Worker; this class exposes only the
 * atomic consume operation and never returns stored fingerprints.
 */
export class ReplayMarkerDurableObject {
  constructor(ctx) {
    this.ctx = ctx;
    this.shard = new ReplayMarkerShard(ctx);
  }

  async fetch(request) {
    if (request.method !== "POST") {
      return Response.json({ error: "method_not_allowed" }, { status: 405 });
    }

    const url = new URL(request.url);
    if (url.pathname !== "/consume") {
      return Response.json({ error: "not_found" }, { status: 404 });
    }

    let input;
    try {
      input = await request.json();
    } catch {
      return Response.json({ error: "invalid_json" }, { status: 400 });
    }

    if (
      !input
      || typeof input !== "object"
      || Array.isArray(input)
      || !FINGERPRINT_PATTERN.test(input.fingerprint ?? "")
      || !Number.isSafeInteger(input.expiresAt)
    ) {
      return Response.json({ error: "invalid_replay_marker" }, { status: 400 });
    }

    try {
      const consumed = await this.shard.consumeOnce({
        fingerprint: input.fingerprint,
        expiresAt: input.expiresAt,
      });
      return Response.json({ consumed });
    } catch {
      // Do not expose storage details or turn failures into a successful consume.
      return Response.json({ error: "replay_marker_unavailable" }, { status: 503 });
    }
  }

  async alarm() {
    await this.shard.alarm();
  }
}

/**
 * Adapts a Cloudflare Durable Object namespace to sessionBootstrap's injected
 * consumeReplayMarker contract. A deterministic shard name is required so
 * the same fingerprint always reaches the same atomic storage transaction.
 */
export function createReplayMarkerConsumer(namespace) {
  if (
    !namespace
    || typeof namespace.idFromName !== "function"
    || typeof namespace.get !== "function"
  ) {
    throw new TypeError("invalid_replay_marker_namespace");
  }

  return async ({ shardName, fingerprint, expiresAt } = {}) => {
    if (
      typeof shardName !== "string"
      || !SHARD_NAME_PATTERN.test(shardName)
      || typeof fingerprint !== "string"
      || !FINGERPRINT_PATTERN.test(fingerprint)
      || !Number.isSafeInteger(expiresAt)
    ) {
      throw new TypeError("invalid_replay_marker_request");
    }

    const id = namespace.idFromName(shardName);
    const stub = namespace.get(id);
    if (!stub || typeof stub.fetch !== "function") {
      throw new TypeError("invalid_replay_marker_stub");
    }

    const response = await stub.fetch(INTERNAL_CONSUME_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fingerprint, expiresAt }),
    });
    if (!response.ok) throw new Error("replay_marker_storage_unavailable");

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new Error("invalid_replay_marker_response");
    }
    if (typeof payload?.consumed !== "boolean") {
      throw new Error("invalid_replay_marker_response");
    }
    return payload.consumed;
  };
}
