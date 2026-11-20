import {
  createReplayMarkerConsumer,
  ReplayMarkerDurableObject,
} from "../../workers/assistant-api/src/replayMarkerDurableObject.js";

const TEST_SHARD_NAME = "v1:ab";

export class ReplayMarkerTestDO extends ReplayMarkerDurableObject {
  constructor(ctx, env) {
    super(ctx, env);
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (request.method !== "POST") {
      return new Response("method_not_allowed", { status: 405 });
    }

    if (url.pathname === "/state") {
      const count = this.ctx.storage.sql
        .exec("SELECT COUNT(*) AS count FROM replay_markers")
        .toArray()[0].count;
      return Response.json({
        count,
        alarmAt: await this.ctx.storage.getAlarm(),
      });
    }

    if (url.pathname === "/expire-and-alarm") {
      this.ctx.storage.sql.exec(
        "UPDATE replay_markers SET expires_at = ?",
        Date.now() - 1,
      );
      await this.alarm();
      const count = this.ctx.storage.sql
        .exec("SELECT COUNT(*) AS count FROM replay_markers")
        .toArray()[0].count;
      return Response.json({
        count,
        alarmAt: await this.ctx.storage.getAlarm(),
      });
    }

    return super.fetch(request);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== "POST") {
      return new Response("method_not_allowed", { status: 405 });
    }

    const consume = createReplayMarkerConsumer(env.REPLAY_MARKERS);
    if (url.pathname === "/consume") {
      let input;
      try {
        input = await request.json();
      } catch {
        return Response.json({ error: "invalid_json" }, { status: 400 });
      }
      try {
        const consumed = await consume({
          shardName: TEST_SHARD_NAME,
          fingerprint: input?.fingerprint,
          expiresAt: input?.expiresAt,
        });
        return Response.json({ consumed });
      } catch {
        return Response.json({ error: "replay_marker_unavailable" }, { status: 503 });
      }
    }

    const id = env.REPLAY_MARKERS.idFromName(TEST_SHARD_NAME);
    const stub = env.REPLAY_MARKERS.get(id);
    return stub.fetch(request);
  },
};
