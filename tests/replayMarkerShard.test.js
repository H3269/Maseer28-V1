import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { ReplayMarkerShard } from "../workers/assistant-api/src/replayMarkerShard.js";

class SqlCursor {
  constructor(rows = []) {
    this.rows = rows;
  }

  toArray() {
    return this.rows;
  }
}

function createHarness({ failSetAlarm = false, failSql = false } = {}) {
  const database = new DatabaseSync(":memory:");
  let alarmAt = null;
  let shouldFailSetAlarm = failSetAlarm;
  let shouldFailSql = false;

  const storage = {
    sql: {
      exec(query, ...bindings) {
        if (shouldFailSql) {
          shouldFailSql = false;
          throw new Error("simulated_sql_failure");
        }

        if (/^\s*CREATE TABLE|^\s*CREATE INDEX/i.test(query.trim())) {
          database.exec(query);
          return new SqlCursor();
        }

        const statement = database.prepare(query);
        if (statement.columns().length > 0) {
          return new SqlCursor(statement.all(...bindings));
        }

        statement.run(...bindings);
        return new SqlCursor();
      },
    },
    transactionSync(callback) {
      database.exec("BEGIN IMMEDIATE");
      try {
        const result = callback();
        database.exec("COMMIT");
        return result;
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    },
    async getAlarm() {
      return alarmAt;
    },
    async setAlarm(value) {
      if (shouldFailSetAlarm) {
        shouldFailSetAlarm = false;
        throw new Error("simulated_alarm_failure");
      }
      alarmAt = value instanceof Date ? value.getTime() : value;
    },
    async deleteAlarm() {
      alarmAt = null;
    },
  };

  return {
    shard: new ReplayMarkerShard({ storage }),
    storage,
    database,
    enableSqlFailure() {
      shouldFailSql = true;
    },
    get alarmAt() {
      return alarmAt;
    },
  };
}

const fingerprint = (character) => character.repeat(64);

test("the same live fingerprint is consumed only once", async () => {
  const harness = createHarness();
  const input = {
    fingerprint: fingerprint("a"),
    expiresAt: Date.now() + 120_000,
  };

  assert.equal(await harness.shard.consumeOnce(input), true);
  assert.equal(await harness.shard.consumeOnce(input), false);
  assert.equal(
    harness.database.prepare("SELECT COUNT(*) AS count FROM replay_markers").get().count,
    1,
  );
});

test("concurrent duplicate requests have exactly one winner", async () => {
  const harness = createHarness();
  const input = {
    fingerprint: fingerprint("b"),
    expiresAt: Date.now() + 120_000,
  };

  const results = await Promise.all([
    harness.shard.consumeOnce(input),
    harness.shard.consumeOnce(input),
  ]);

  assert.deepEqual(results.sort(), [false, true]);
  assert.equal(
    harness.database.prepare("SELECT COUNT(*) AS count FROM replay_markers").get().count,
    1,
  );
});

test("different fingerprints are accepted and an earlier alarm is never postponed", async () => {
  const harness = createHarness();
  const now = Date.now();

  assert.equal(await harness.shard.consumeOnce({
    fingerprint: fingerprint("c"),
    expiresAt: now + 300_000,
    now,
  }), true);
  const firstAlarm = harness.alarmAt;

  assert.equal(await harness.shard.consumeOnce({
    fingerprint: fingerprint("d"),
    expiresAt: now + 400_000,
    now: now + 1,
  }), true);
  assert.equal(harness.alarmAt, firstAlarm);
});

test("an expired marker can be replaced after the verifier expiry window", async () => {
  const harness = createHarness();
  const id = fingerprint("e");

  assert.equal(await harness.shard.consumeOnce({
    fingerprint: id,
    expiresAt: 1_100,
    now: 1_000,
  }), true);

  assert.equal(await harness.shard.consumeOnce({
    fingerprint: id,
    expiresAt: 2_000,
    now: 1_200,
  }), true);
  assert.equal(
    harness.database.prepare("SELECT expires_at FROM replay_markers WHERE fingerprint = ?").get(id).expires_at,
    2_000,
  );
});

test("alarm scheduling failure fails closed before any marker is inserted", async () => {
  const harness = createHarness({ failSetAlarm: true });

  await assert.rejects(
    harness.shard.consumeOnce({
      fingerprint: fingerprint("f"),
      expiresAt: Date.now() + 120_000,
    }),
    /simulated_alarm_failure/,
  );
  assert.equal(
    harness.database.prepare("SELECT COUNT(*) AS count FROM replay_markers").get().count,
    0,
  );
});

test("SQL failure fails closed and does not return a successful consume result", async () => {
  const harness = createHarness();
  harness.enableSqlFailure();

  await assert.rejects(
    harness.shard.consumeOnce({
      fingerprint: fingerprint("1"),
      expiresAt: Date.now() + 120_000,
    }),
    /simulated_sql_failure/,
  );
  assert.equal(
    harness.database.prepare("SELECT COUNT(*) AS count FROM replay_markers").get().count,
    0,
  );
});

test("alarm cleanup removes expired markers and schedules the next live expiry", async () => {
  const harness = createHarness();
  const now = Date.now();

  await harness.shard.consumeOnce({
    fingerprint: fingerprint("2"),
    expiresAt: now + 10_000,
  });
  await harness.shard.consumeOnce({
    fingerprint: fingerprint("3"),
    expiresAt: now + 20_000,
  });

  harness.database.prepare("UPDATE replay_markers SET expires_at = ? WHERE fingerprint = ?")
    .run(now - 1, fingerprint("2"));

  await harness.shard.alarm();

  assert.equal(
    harness.database.prepare("SELECT COUNT(*) AS count FROM replay_markers").get().count,
    1,
  );
  assert.equal(harness.alarmAt, now + 20_000);
});

test("alarm handler failure is surfaced so Cloudflare can retry it", async () => {
  const harness = createHarness();
  await harness.shard.consumeOnce({
    fingerprint: fingerprint("4"),
    expiresAt: Date.now() + 120_000,
  });

  harness.storage.setAlarm = async () => {
    throw new Error("simulated_reschedule_failure");
  };

  await assert.rejects(harness.shard.alarm(), /simulated_reschedule_failure/);
});
