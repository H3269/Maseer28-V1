const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;
const CLEANUP_BATCH_SIZE = 100;
const ALARM_SAFETY_INTERVAL_MS = 60_000;
const ALARM_RETRY_INTERVAL_MS = 1_000;

function consumeExpiredBatch(sql, now) {
  sql.exec(
    `DELETE FROM replay_markers
     WHERE rowid IN (
       SELECT rowid
       FROM replay_markers
       WHERE expires_at <= ?
       ORDER BY expires_at ASC
       LIMIT ?
     )`,
    now,
    CLEANUP_BATCH_SIZE,
  );
}

export class ReplayMarkerShard {
  constructor(ctx) {
    this.ctx = ctx;
    this.sql = ctx.storage.sql;
    this.alarmQueue = Promise.resolve();

    // Schema creation is synchronous and does not schedule an alarm.
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS replay_markers (
        fingerprint TEXT PRIMARY KEY
          CHECK(length(fingerprint) = 64),
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS replay_markers_expiry_idx
        ON replay_markers(expires_at);
    `);
  }

  async consumeOnce({ fingerprint, expiresAt }) {
    const now = Date.now();
    if (typeof fingerprint !== "string" || !FINGERPRINT_PATTERN.test(fingerprint)) {
      throw new TypeError("invalid_fingerprint");
    }
    if (!Number.isSafeInteger(now) || !Number.isSafeInteger(expiresAt) || expiresAt <= now) {
      throw new TypeError("invalid_expiry");
    }

    // Establish cleanup before inserting. If alarm storage fails, no marker
    // is written and the caller must not issue a session.
    await this.#scheduleAlarmNoLaterThan(
      Math.min(expiresAt, now + ALARM_SAFETY_INTERVAL_MS),
    );

    return this.ctx.storage.transactionSync(() => {
      // Opportunistic bounded cleanup makes progress even after Alarm retries
      // are exhausted or an alarm is delayed.
      consumeExpiredBatch(this.sql, now);

      const existing = this.sql
        .exec(
          "SELECT expires_at FROM replay_markers WHERE fingerprint = ?",
          fingerprint,
        )
        .toArray()[0];

      if (existing && existing.expires_at > now) {
        return false;
      }

      if (existing) {
        this.sql.exec(
          "DELETE FROM replay_markers WHERE fingerprint = ?",
          fingerprint,
        );
      }

      this.sql.exec(
        "INSERT INTO replay_markers (fingerprint, expires_at) VALUES (?, ?)",
        fingerprint,
        expiresAt,
      );
      return true;
    });
  }

  async alarm() {
    // Serialize the SQL snapshot and alarm replacement with consumeOnce()
    // scheduling. Otherwise a concurrent consume could insert a marker after
    // this snapshot and have its newly scheduled alarm deleted as stale.
    return this.#enqueueAlarmOperation(async () => {
      const now = Date.now();
      const nextExpiry = this.ctx.storage.transactionSync(() => {
        consumeExpiredBatch(this.sql, now);
        const row = this.sql
          .exec("SELECT MIN(expires_at) AS next_expiry FROM replay_markers")
          .toArray()[0];
        return row?.next_expiry ?? null;
      });

      if (nextExpiry === null) {
        await this.ctx.storage.deleteAlarm();
        return;
      }

      // If a bounded batch left already-expired rows, continue shortly.
      const nextAlarm = nextExpiry <= now
        ? now + ALARM_RETRY_INTERVAL_MS
        : nextExpiry;
      await this.ctx.storage.setAlarm(nextAlarm);
    });
  }

  #enqueueAlarmOperation(operation) {
    const pending = this.alarmQueue.then(operation);
    this.alarmQueue = pending.catch(() => undefined);
    return pending;
  }

  #scheduleAlarmNoLaterThan(target) {
    return this.#enqueueAlarmOperation(async () => {
      const current = await this.ctx.storage.getAlarm();
      if (current === null || current > target) {
        await this.ctx.storage.setAlarm(target);
      }
    });
  }

}
