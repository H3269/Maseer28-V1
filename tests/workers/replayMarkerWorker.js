import { ReplayMarkerShard } from "../../workers/assistant-api/src/replayMarkerShard.js";

export class ReplayMarkerTestDO {
  constructor(ctx) {
    this.ctx = ctx;
    this.shard = new ReplayMarkerShard(ctx);
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (request.method !== "POST") {
      return new Response("method_not_allowed", { status: 405 });
    }

    if (url.pathname === "/consume") {
      const input = await request.json();
      const consumed = await this.shard.consumeOnce(input);
      return Response.json({ consumed });
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
      await this.shard.alarm();
      const count = this.ctx.storage.sql
        .exec("SELECT COUNT(*) AS count FROM replay_markers")
        .toArray()[0].count;
      return Response.json({
        count,
        alarmAt: await this.ctx.storage.getAlarm(),
      });
    }

    return new Response("not_found", { status: 404 });
  }
}

export default {
  async fetch(request, env) {
    const id = env.REPLAY_MARKERS.idFromName("replay-marker-integration-shard");
    return env.REPLAY_MARKERS.get(id).fetch(request);
  },
};
