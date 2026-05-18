import { mkdirSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export class Store {
  constructor(dbPath) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.dbPath = dbPath;
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA synchronous = NORMAL');
    this.db.exec('PRAGMA temp_store = MEMORY');
    this._writeQueue = [];
    this.prepareSchema();
    this.prepareStatements();
  }

  sizeBytes() {
    return [this.dbPath, `${this.dbPath}-wal`, `${this.dbPath}-shm`].reduce((total, filePath) => {
      try {
        return total + statSync(filePath).size;
      } catch (error) {
        if (error.code === 'ENOENT') return total;
        throw error;
      }
    }, 0);
  }

  prepareSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS samples (
        ts INTEGER PRIMARY KEY,
        wan_down_bps INTEGER NOT NULL,
        wan_up_bps INTEGER NOT NULL,
        wan_download_total INTEGER NOT NULL,
        wan_upload_total INTEGER NOT NULL,
        cpu_load REAL NOT NULL,
        mem_usage REAL NOT NULL,
        uptime_seconds REAL NOT NULL DEFAULT 0,
        online_count INTEGER NOT NULL,
        all_count INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS clients (
        mac TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        oname TEXT NOT NULL,
        ip TEXT,
        type INTEGER,
        is_ap INTEGER,
        parent TEXT,
        last_seen_ts INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS client_samples (
        ts INTEGER NOT NULL,
        mac TEXT NOT NULL,
        down_bps INTEGER NOT NULL,
        up_bps INTEGER NOT NULL,
        online_seconds INTEGER NOT NULL,
        active INTEGER NOT NULL,
        PRIMARY KEY (ts, mac)
      );

      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS samples_1m (
        ts INTEGER PRIMARY KEY,
        down_avg REAL NOT NULL DEFAULT 0,
        down_min REAL NOT NULL DEFAULT 0,
        down_max REAL NOT NULL DEFAULT 0,
        up_avg REAL NOT NULL DEFAULT 0,
        up_min REAL NOT NULL DEFAULT 0,
        up_max REAL NOT NULL DEFAULT 0,
        down_bytes REAL NOT NULL DEFAULT 0,
        up_bytes REAL NOT NULL DEFAULT 0,
        online_avg REAL NOT NULL DEFAULT 0,
        cpu_avg REAL NOT NULL DEFAULT 0,
        mem_avg REAL NOT NULL DEFAULT 0,
        n INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS samples_1h (
        ts INTEGER PRIMARY KEY,
        down_avg REAL NOT NULL DEFAULT 0,
        down_min REAL NOT NULL DEFAULT 0,
        down_max REAL NOT NULL DEFAULT 0,
        up_avg REAL NOT NULL DEFAULT 0,
        up_min REAL NOT NULL DEFAULT 0,
        up_max REAL NOT NULL DEFAULT 0,
        down_bytes REAL NOT NULL DEFAULT 0,
        up_bytes REAL NOT NULL DEFAULT 0,
        online_avg REAL NOT NULL DEFAULT 0,
        cpu_avg REAL NOT NULL DEFAULT 0,
        mem_avg REAL NOT NULL DEFAULT 0,
        n INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS samples_1d (
        ts INTEGER PRIMARY KEY,
        down_avg REAL NOT NULL DEFAULT 0,
        down_min REAL NOT NULL DEFAULT 0,
        down_max REAL NOT NULL DEFAULT 0,
        up_avg REAL NOT NULL DEFAULT 0,
        up_min REAL NOT NULL DEFAULT 0,
        up_max REAL NOT NULL DEFAULT 0,
        down_bytes REAL NOT NULL DEFAULT 0,
        up_bytes REAL NOT NULL DEFAULT 0,
        online_avg REAL NOT NULL DEFAULT 0,
        cpu_avg REAL NOT NULL DEFAULT 0,
        mem_avg REAL NOT NULL DEFAULT 0,
        n INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS client_samples_1m (
        ts INTEGER NOT NULL,
        mac TEXT NOT NULL,
        down_avg REAL NOT NULL DEFAULT 0,
        down_min REAL NOT NULL DEFAULT 0,
        down_max REAL NOT NULL DEFAULT 0,
        up_avg REAL NOT NULL DEFAULT 0,
        up_min REAL NOT NULL DEFAULT 0,
        up_max REAL NOT NULL DEFAULT 0,
        down_bytes REAL NOT NULL DEFAULT 0,
        up_bytes REAL NOT NULL DEFAULT 0,
        n INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (ts, mac)
      );

      CREATE TABLE IF NOT EXISTS client_samples_1h (
        ts INTEGER NOT NULL,
        mac TEXT NOT NULL,
        down_avg REAL NOT NULL DEFAULT 0,
        down_min REAL NOT NULL DEFAULT 0,
        down_max REAL NOT NULL DEFAULT 0,
        up_avg REAL NOT NULL DEFAULT 0,
        up_min REAL NOT NULL DEFAULT 0,
        up_max REAL NOT NULL DEFAULT 0,
        down_bytes REAL NOT NULL DEFAULT 0,
        up_bytes REAL NOT NULL DEFAULT 0,
        n INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (ts, mac)
      );

      CREATE TABLE IF NOT EXISTS client_samples_1d (
        ts INTEGER NOT NULL,
        mac TEXT NOT NULL,
        down_avg REAL NOT NULL DEFAULT 0,
        down_min REAL NOT NULL DEFAULT 0,
        down_max REAL NOT NULL DEFAULT 0,
        up_avg REAL NOT NULL DEFAULT 0,
        up_min REAL NOT NULL DEFAULT 0,
        up_max REAL NOT NULL DEFAULT 0,
        down_bytes REAL NOT NULL DEFAULT 0,
        up_bytes REAL NOT NULL DEFAULT 0,
        n INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (ts, mac)
      );

      CREATE INDEX IF NOT EXISTS idx_client_samples_mac_ts ON client_samples(mac, ts);
      CREATE INDEX IF NOT EXISTS idx_client_samples_ts ON client_samples(ts);
      CREATE INDEX IF NOT EXISTS idx_samples_ts ON samples(ts);
      CREATE INDEX IF NOT EXISTS idx_client_samples_1m_mac_ts ON client_samples_1m(mac, ts);
      CREATE INDEX IF NOT EXISTS idx_client_samples_1h_mac_ts ON client_samples_1h(mac, ts);
      CREATE INDEX IF NOT EXISTS idx_client_samples_1d_mac_ts ON client_samples_1d(mac, ts);
    `);
    this.ensureColumn('samples', 'uptime_seconds', 'REAL NOT NULL DEFAULT 0');
  }

  ensureColumn(table, column, definition) {
    const rows = this.db.prepare(`PRAGMA table_info(${table})`).all();
    if (rows.some((row) => row.name === column)) return;
    this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }

  prepareStatements() {
    this.insertSample = this.db.prepare(`
      INSERT OR REPLACE INTO samples
      (ts, wan_down_bps, wan_up_bps, wan_download_total, wan_upload_total, cpu_load, mem_usage, uptime_seconds, online_count, all_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.upsertClient = this.db.prepare(`
      INSERT INTO clients (mac, name, oname, ip, type, is_ap, parent, last_seen_ts)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(mac) DO UPDATE SET
        name = CASE WHEN clients.name = clients.mac OR clients.name = ''
                    THEN excluded.name ELSE clients.name END,
        oname = excluded.oname,
        ip = excluded.ip,
        type = excluded.type,
        is_ap = excluded.is_ap,
        parent = excluded.parent,
        last_seen_ts = excluded.last_seen_ts
    `);
    this.insertClientSample = this.db.prepare(`
      INSERT OR REPLACE INTO client_samples
      (ts, mac, down_bps, up_bps, online_seconds, active)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
  }

  queueSnapshot(snapshot) {
    const ts = Math.floor(Date.now() / 1000);
    this._writeQueue.push({ snapshot, ts });
    return ts;
  }

  flush() {
    if (this._writeQueue.length === 0) return 0;
    const batch = this._writeQueue.splice(0);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const { snapshot, ts } of batch) {
        this._writeSample(snapshot, ts);
      }
      const { snapshot: last, ts: lastTs } = batch[batch.length - 1];
      this.db.prepare(`
        INSERT INTO meta (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run('last_snapshot', JSON.stringify({
        ts: lastTs,
        router: last.status.hardware,
        counts: last.status.count,
        wan: last.wan,
        topo: last.topo,
        wifi: sanitizeWifi(last.wifi)
      }));
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      this._writeQueue.unshift(...batch);
      throw error;
    }
    return batch.length;
  }

  _writeSample(snapshot, ts) {
    this.insertSample.run(
      ts,
      asNumber(snapshot.status.wan?.downspeed),
      asNumber(snapshot.status.wan?.upspeed),
      asNumber(snapshot.status.wan?.download),
      asNumber(snapshot.status.wan?.upload),
      asNumber(snapshot.status.cpu?.load),
      asNumber(snapshot.status.mem?.usage),
      asNumber(snapshot.status.upTime ?? snapshot.status.uptime),
      asNumber(snapshot.status.count?.online),
      asNumber(snapshot.status.count?.all)
    );
    for (const client of snapshot.devices?.list ?? []) {
      if (!client.mac) continue;
      const ip = client.ip?.find((item) => item.active)?.ip || client.ip?.[0]?.ip || '';
      const stats = client.statistics ?? {};
      this.upsertClient.run(
        client.mac,
        client.name || client.oname || client.mac,
        client.oname || '',
        ip,
        asNumber(client.type),
        asNumber(client.isap),
        client.parent || '',
        ts
      );
      this.insertClientSample.run(
        ts,
        client.mac,
        asNumber(stats.downspeed),
        asNumber(stats.upspeed),
        asNumber(stats.online),
        asNumber(client.online) ? 1 : 0
      );
    }
  }

  rollup() {
    const now = Math.floor(Date.now() / 1000);
    const curMin = Math.floor(now / 60) * 60;
    const curHour = Math.floor(now / 3600) * 3600;
    const curDay = Math.floor(now / 86400) * 86400;

    const last1m = Number(this.getMeta('rl_s_1m')) || 0;
    const last1h = Number(this.getMeta('rl_s_1h')) || 0;
    const last1d = Number(this.getMeta('rl_s_1d')) || 0;
    const lastC1m = Number(this.getMeta('rl_c_1m')) || 0;
    const lastC1h = Number(this.getMeta('rl_c_1h')) || 0;
    const lastC1d = Number(this.getMeta('rl_c_1d')) || 0;

    if (curMin > last1m) {
      this.db.prepare(`
        INSERT OR REPLACE INTO samples_1m
          (ts, down_avg, down_min, down_max, up_avg, up_min, up_max, down_bytes, up_bytes, online_avg, cpu_avg, mem_avg, n)
        SELECT CAST(ts / 60 AS INTEGER) * 60,
          AVG(wan_down_bps), MIN(wan_down_bps), MAX(wan_down_bps),
          AVG(wan_up_bps), MIN(wan_up_bps), MAX(wan_up_bps),
          AVG(wan_down_bps) * 60, AVG(wan_up_bps) * 60,
          AVG(online_count), AVG(cpu_load), AVG(mem_usage), COUNT(*)
        FROM samples WHERE ts >= ? AND ts < ?
        GROUP BY CAST(ts / 60 AS INTEGER)
      `).run(last1m, curMin);
      this.setMeta('rl_s_1m', String(curMin));
    }

    if (curHour > last1h) {
      this.db.prepare(`
        INSERT OR REPLACE INTO samples_1h
          (ts, down_avg, down_min, down_max, up_avg, up_min, up_max, down_bytes, up_bytes, online_avg, cpu_avg, mem_avg, n)
        SELECT CAST(ts / 3600 AS INTEGER) * 3600,
          AVG(down_avg), MIN(down_min), MAX(down_max),
          AVG(up_avg), MIN(up_min), MAX(up_max),
          SUM(down_bytes), SUM(up_bytes),
          AVG(online_avg), AVG(cpu_avg), AVG(mem_avg), SUM(n)
        FROM samples_1m WHERE ts >= ? AND ts < ?
        GROUP BY CAST(ts / 3600 AS INTEGER)
      `).run(last1h, curHour);
      this.setMeta('rl_s_1h', String(curHour));
    }

    if (curDay > last1d) {
      this.db.prepare(`
        INSERT OR REPLACE INTO samples_1d
          (ts, down_avg, down_min, down_max, up_avg, up_min, up_max, down_bytes, up_bytes, online_avg, cpu_avg, mem_avg, n)
        SELECT CAST(ts / 86400 AS INTEGER) * 86400,
          AVG(down_avg), MIN(down_min), MAX(down_max),
          AVG(up_avg), MIN(up_min), MAX(up_max),
          SUM(down_bytes), SUM(up_bytes),
          AVG(online_avg), AVG(cpu_avg), AVG(mem_avg), SUM(n)
        FROM samples_1h WHERE ts >= ? AND ts < ?
        GROUP BY CAST(ts / 86400 AS INTEGER)
      `).run(last1d, curDay);
      this.setMeta('rl_s_1d', String(curDay));
    }

    if (curMin > lastC1m) {
      this.db.prepare(`
        INSERT OR REPLACE INTO client_samples_1m
          (ts, mac, down_avg, down_min, down_max, up_avg, up_min, up_max, down_bytes, up_bytes, n)
        SELECT CAST(ts / 60 AS INTEGER) * 60, mac,
          AVG(down_bps), MIN(down_bps), MAX(down_bps),
          AVG(up_bps), MIN(up_bps), MAX(up_bps),
          AVG(down_bps) * 60, AVG(up_bps) * 60, COUNT(*)
        FROM client_samples WHERE ts >= ? AND ts < ?
        GROUP BY CAST(ts / 60 AS INTEGER), mac
      `).run(lastC1m, curMin);
      this.setMeta('rl_c_1m', String(curMin));
    }

    if (curHour > lastC1h) {
      this.db.prepare(`
        INSERT OR REPLACE INTO client_samples_1h
          (ts, mac, down_avg, down_min, down_max, up_avg, up_min, up_max, down_bytes, up_bytes, n)
        SELECT CAST(ts / 3600 AS INTEGER) * 3600, mac,
          AVG(down_avg), MIN(down_min), MAX(down_max),
          AVG(up_avg), MIN(up_min), MAX(up_max),
          SUM(down_bytes), SUM(up_bytes), SUM(n)
        FROM client_samples_1m WHERE ts >= ? AND ts < ?
        GROUP BY CAST(ts / 3600 AS INTEGER), mac
      `).run(lastC1h, curHour);
      this.setMeta('rl_c_1h', String(curHour));
    }

    if (curDay > lastC1d) {
      this.db.prepare(`
        INSERT OR REPLACE INTO client_samples_1d
          (ts, mac, down_avg, down_min, down_max, up_avg, up_min, up_max, down_bytes, up_bytes, n)
        SELECT CAST(ts / 86400 AS INTEGER) * 86400, mac,
          AVG(down_avg), MIN(down_min), MAX(down_max),
          AVG(up_avg), MIN(up_min), MAX(up_max),
          SUM(down_bytes), SUM(up_bytes), SUM(n)
        FROM client_samples_1h WHERE ts >= ? AND ts < ?
        GROUP BY CAST(ts / 86400 AS INTEGER), mac
      `).run(lastC1d, curDay);
      this.setMeta('rl_c_1d', String(curDay));
    }
  }

  setMeta(key, value) {
    this.db.prepare(`
      INSERT INTO meta (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, value);
  }

  getMeta(key) {
    const row = this.db.prepare('SELECT value FROM meta WHERE key = ?').get(key);
    if (!row) return null;
    try {
      return JSON.parse(row.value);
    } catch {
      return row.value;
    }
  }

  cleanup(retentionDetDays, retentionAggDays) {
    const now = Math.floor(Date.now() / 1000);
    const detCutoff = now - retentionDetDays * 86400;
    const aggCutoff = now - retentionAggDays * 86400;
    this.db.prepare('DELETE FROM samples WHERE ts < ?').run(detCutoff);
    this.db.prepare('DELETE FROM client_samples WHERE ts < ?').run(detCutoff);
    this.db.prepare('DELETE FROM samples_1m WHERE ts < ?').run(detCutoff);
    this.db.prepare('DELETE FROM client_samples_1m WHERE ts < ?').run(detCutoff);
    this.db.prepare('DELETE FROM samples_1h WHERE ts < ?').run(aggCutoff);
    this.db.prepare('DELETE FROM client_samples_1h WHERE ts < ?').run(aggCutoff);
    this.db.prepare('DELETE FROM samples_1d WHERE ts < ?').run(aggCutoff);
    this.db.prepare('DELETE FROM client_samples_1d WHERE ts < ?').run(aggCutoff);
  }

  summary() {
    const latest = this.db.prepare('SELECT * FROM samples ORDER BY ts DESC LIMIT 1').get() ?? null;
    const lastSnapshot = this.getMeta('last_snapshot');
    const topClients = this.db.prepare(`
      SELECT c.mac, c.name, c.oname, c.ip, c.parent, c.type, c.is_ap,
             cs.down_bps, cs.up_bps, cs.online_seconds, cs.active
      FROM client_samples cs
      JOIN clients c ON c.mac = cs.mac
      WHERE cs.ts = (SELECT MAX(ts) FROM client_samples)
      ORDER BY (cs.down_bps + cs.up_bps) DESC
      LIMIT 12
    `).all();
    const now = Math.floor(Date.now() / 1000);
    const count1m = this.db.prepare('SELECT COUNT(*) AS n FROM samples_1m WHERE ts >= ?');
    const count1h = this.db.prepare('SELECT COUNT(*) AS n FROM samples_1h WHERE ts >= ?');
    const count1d = this.db.prepare('SELECT COUNT(*) AS n FROM samples_1d WHERE ts >= ?');
    const rangePoints = {
      '1h':  count1m.get(now - 3600)?.n ?? 0,
      '6h':  count1m.get(now - 21600)?.n ?? 0,
      '1d':  count1h.get(now - 86400)?.n ?? 0,
      '30d': count1d.get(now - 2592000)?.n ?? 0
    };
    return { latest, lastSnapshot, topClients, rangePoints };
  }

  clients() {
    return this.db.prepare(`
      SELECT c.mac, c.name, c.oname, c.ip, c.parent, c.type, c.is_ap, c.last_seen_ts,
             COALESCE(last.down_bps, 0) AS down_bps,
             COALESCE(last.up_bps, 0) AS up_bps,
             COALESCE(last.active, 0) AS active
      FROM clients c
      LEFT JOIN client_samples last
        ON last.mac = c.mac
       AND last.ts = (SELECT MAX(ts) FROM client_samples)
      ORDER BY active DESC, (down_bps + up_bps) DESC, name COLLATE NOCASE
      LIMIT 500
    `).all();
  }

  series({ from, to, maxPoints = 900, mac = '' }) {
    const span = Math.max(1, to - from);
    const { tier, bucket } = seriesTier(span, maxPoints);

    if (tier === 'raw') {
      return this._seriesRaw({ from, to, bucket, mac });
    }
    return this._seriesRollup({ from, to, bucket, tier, mac });
  }

  _seriesRaw({ from, to, bucket, mac }) {
    if (mac) {
      return {
        bucket,
        hasBand: bucket > 1,
        points: this.db.prepare(`
          WITH ranged AS (
            SELECT
              ts,
              down_bps,
              up_bps,
              LEAD(ts) OVER (ORDER BY ts) AS next_ts
            FROM client_samples
            WHERE ts BETWEEN ? AND ? AND mac = ?
          )
          SELECT CAST(ts / ? AS INTEGER) * ? AS ts,
                 AVG(down_bps) AS down_bps,
                 AVG(up_bps) AS up_bps,
                 MIN(down_bps) AS min_down_bps,
                 MIN(up_bps) AS min_up_bps,
                 MAX(down_bps) AS max_down_bps,
                 MAX(up_bps) AS max_up_bps,
                 SUM(down_bps * MAX(0, MIN(COALESCE(next_ts, ?), ?) - ts)) AS down_bytes,
                 SUM(up_bps * MAX(0, MIN(COALESCE(next_ts, ?), ?) - ts)) AS up_bytes
          FROM ranged
          GROUP BY CAST(ts / ? AS INTEGER)
          ORDER BY ts
        `).all(from, to, mac, bucket, bucket, to, to, to, to, bucket)
      };
    }

    return {
      bucket,
      hasBand: bucket > 1,
      points: this.db.prepare(`
        WITH ranged AS (
          SELECT
            ts,
            wan_down_bps,
            wan_up_bps,
            online_count,
            LEAD(ts) OVER (ORDER BY ts) AS next_ts
          FROM samples
          WHERE ts BETWEEN ? AND ?
        )
        SELECT CAST(ts / ? AS INTEGER) * ? AS ts,
               AVG(wan_down_bps) AS down_bps,
               AVG(wan_up_bps) AS up_bps,
               MIN(wan_down_bps) AS min_down_bps,
               MIN(wan_up_bps) AS min_up_bps,
               MAX(wan_down_bps) AS max_down_bps,
               MAX(wan_up_bps) AS max_up_bps,
               SUM(wan_down_bps * MAX(0, MIN(COALESCE(next_ts, ?), ?) - ts)) AS down_bytes,
               SUM(wan_up_bps * MAX(0, MIN(COALESCE(next_ts, ?), ?) - ts)) AS up_bytes,
               AVG(online_count) AS online_count
        FROM ranged
        GROUP BY CAST(ts / ? AS INTEGER)
        ORDER BY ts
      `).all(from, to, bucket, bucket, to, to, to, to, bucket)
    };
  }

  _seriesRollup({ from, to, bucket, tier, mac }) {
    const chain = ROLLUP_CHAIN.slice(ROLLUP_CHAIN.indexOf(tier));

    for (let i = 0; i < chain.length; i++) {
      const src = chain[i];
      const points = i === 0
        ? this._rollupDirect(src, from, to, bucket, mac)
        : this._rollupAgg(src, from, to, bucket, mac);

      if (points.length >= MIN_TIER_POINTS || i === chain.length - 1) {
        return { bucket, hasBand: points.length > 0, points };
      }
    }

    return { bucket, hasBand: false, points: [] };
  }

  _rollupDirect(tier, from, to, bucket, mac) {
    if (mac) {
      return this.db.prepare(`
        SELECT ts,
          down_avg AS down_bps, down_min AS min_down_bps, down_max AS max_down_bps,
          up_avg AS up_bps, up_min AS min_up_bps, up_max AS max_up_bps,
          down_bytes, up_bytes
        FROM client_samples_${tier}
        WHERE ts BETWEEN ? AND ? AND mac = ?
        ORDER BY ts
      `).all(from, to, mac);
    }
    return this.db.prepare(`
      SELECT ts,
        down_avg AS down_bps, down_min AS min_down_bps, down_max AS max_down_bps,
        up_avg AS up_bps, up_min AS min_up_bps, up_max AS max_up_bps,
        down_bytes, up_bytes, online_avg AS online_count
      FROM samples_${tier}
      WHERE ts BETWEEN ? AND ?
      ORDER BY ts
    `).all(from, to);
  }

  _rollupAgg(srcTier, from, to, bucket, mac) {
    if (mac) {
      return this.db.prepare(`
        SELECT CAST(ts / ? AS INTEGER) * ? AS ts,
          AVG(down_avg) AS down_bps, MIN(down_min) AS min_down_bps, MAX(down_max) AS max_down_bps,
          AVG(up_avg) AS up_bps, MIN(up_min) AS min_up_bps, MAX(up_max) AS max_up_bps,
          SUM(down_bytes) AS down_bytes, SUM(up_bytes) AS up_bytes
        FROM client_samples_${srcTier}
        WHERE ts BETWEEN ? AND ? AND mac = ?
        GROUP BY CAST(ts / ? AS INTEGER)
        ORDER BY ts
      `).all(bucket, bucket, from, to, mac, bucket);
    }
    return this.db.prepare(`
      SELECT CAST(ts / ? AS INTEGER) * ? AS ts,
        AVG(down_avg) AS down_bps, MIN(down_min) AS min_down_bps, MAX(down_max) AS max_down_bps,
        AVG(up_avg) AS up_bps, MIN(up_min) AS min_up_bps, MAX(up_max) AS max_up_bps,
        SUM(down_bytes) AS down_bytes, SUM(up_bytes) AS up_bytes,
        AVG(online_avg) AS online_count
      FROM samples_${srcTier}
      WHERE ts BETWEEN ? AND ?
      GROUP BY CAST(ts / ? AS INTEGER)
      ORDER BY ts
    `).all(bucket, bucket, from, to, bucket);
  }

  usage({ from, to, limit = 9 }) {
    const rows = this.db.prepare(`
      WITH ranged AS (
        SELECT
          mac,
          ts,
          down_bps,
          up_bps,
          LEAD(ts) OVER (PARTITION BY mac ORDER BY ts) AS next_ts
        FROM client_samples
        WHERE ts BETWEEN ? AND ?
      ),
      usage AS (
        SELECT
          mac,
          SUM(down_bps * MAX(0, MIN(COALESCE(next_ts, ?), ?) - ts)) AS down_bytes,
          SUM(up_bps * MAX(0, MIN(COALESCE(next_ts, ?), ?) - ts)) AS up_bytes
        FROM ranged
        GROUP BY mac
      )
      SELECT
        u.mac,
        COALESCE(c.name, u.mac) AS name,
        COALESCE(c.oname, '') AS oname,
        COALESCE(c.ip, '') AS ip,
        COALESCE(u.down_bytes, 0) AS down_bytes,
        COALESCE(u.up_bytes, 0) AS up_bytes
      FROM usage u
      LEFT JOIN clients c ON c.mac = u.mac
      WHERE down_bytes > 0 OR up_bytes > 0
    `).all(from, to, to, to, to, to);

    return {
      from,
      to,
      clients: rows.map((row) => ({
        mac: row.mac,
        name: row.name || row.oname || row.mac,
        ip: row.ip || '',
        down_bytes: Math.max(0, Number(row.down_bytes) || 0),
        up_bytes: Math.max(0, Number(row.up_bytes) || 0)
      })),
      down: topUsage(rows, 'down_bytes', limit),
      up: topUsage(rows, 'up_bytes', limit)
    };
  }
}

const ROLLUP_CHAIN = ['1d', '1h', '1m'];
const MIN_TIER_POINTS = 10;

function seriesTier(span, maxPoints) {
  if (span < 1800) return { tier: 'raw', bucket: Math.max(1, Math.ceil(span / maxPoints)) };
  if (span < 86400) return { tier: '1m', bucket: 60 };
  if (span < 30 * 86400) return { tier: '1h', bucket: 3600 };
  return { tier: '1d', bucket: 86400 };
}

function topUsage(rows, key, limit) {
  const sorted = rows
    .map((row) => ({
      mac: row.mac,
      name: row.name || row.oname || row.mac,
      ip: row.ip || '',
      bytes: Math.max(0, Number(row[key]) || 0)
    }))
    .filter((row) => row.bytes > 0)
    .sort((a, b) => b.bytes - a.bytes);

  const top = sorted.slice(0, limit);
  const otherBytes = sorted.slice(limit).reduce((sum, row) => sum + row.bytes, 0);
  const items = otherBytes > 0
    ? [...top, { mac: 'other', name: 'Other', ip: '', bytes: otherBytes }]
    : top;

  return {
    total: sorted.reduce((sum, row) => sum + row.bytes, 0),
    items
  };
}

function sanitizeWifi(wifi) {
  return {
    code: wifi?.code,
    bsd: wifi?.bsd,
    info: (wifi?.info ?? []).map(({ password, ...band }) => ({
      ...band,
      has_password: Boolean(password)
    }))
  };
}
