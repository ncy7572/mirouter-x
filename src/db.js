import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export class Store {
  constructor(dbPath) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA synchronous = NORMAL');
    this.db.exec('PRAGMA temp_store = MEMORY');
    this.prepareSchema();
    this.prepareStatements();
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

      CREATE INDEX IF NOT EXISTS idx_client_samples_mac_ts ON client_samples(mac, ts);
      CREATE INDEX IF NOT EXISTS idx_client_samples_ts ON client_samples(ts);
      CREATE INDEX IF NOT EXISTS idx_samples_ts ON samples(ts);
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
        name = excluded.name,
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

  saveSnapshot(snapshot) {
    const ts = Math.floor(Date.now() / 1000);
    this.db.exec('BEGIN IMMEDIATE');
    try {
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

      this.setMeta('last_snapshot', JSON.stringify({
        ts,
        router: snapshot.status.hardware,
        counts: snapshot.status.count,
        wan: snapshot.wan,
        topo: snapshot.topo,
        wifi: sanitizeWifi(snapshot.wifi)
      }));
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    return ts;
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

  cleanup(retentionDays) {
    const cutoff = Math.floor(Date.now() / 1000) - retentionDays * 86400;
    this.db.prepare('DELETE FROM samples WHERE ts < ?').run(cutoff);
    this.db.prepare('DELETE FROM client_samples WHERE ts < ?').run(cutoff);
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
    return { latest, lastSnapshot, topClients };
  }

  clients() {
    return this.db.prepare(`
      SELECT c.mac, c.name, c.oname, c.ip, c.parent, c.type, c.is_ap, c.last_seen_ts,
             COALESCE(last.down_bps, 0) AS down_bps,
             COALESCE(last.up_bps, 0) AS up_bps,
             COALESCE(last.active, 0) AS active
      FROM clients c
      LEFT JOIN (
        SELECT cs.*
        FROM client_samples cs
        JOIN (
          SELECT mac, MAX(ts) AS ts FROM client_samples GROUP BY mac
        ) mx ON mx.mac = cs.mac AND mx.ts = cs.ts
      ) last ON last.mac = c.mac
      ORDER BY active DESC, (down_bps + up_bps) DESC, name COLLATE NOCASE
    `).all();
  }

  series({ from, to, maxPoints = 900, mac = '' }) {
    const span = Math.max(1, to - from);
    const bucket = Math.max(1, Math.ceil(span / maxPoints));
    if (mac) {
      return {
        bucket,
        points: this.db.prepare(`
          SELECT CAST(ts / ? AS INTEGER) * ? AS ts,
                 AVG(down_bps) AS down_bps,
                 AVG(up_bps) AS up_bps,
                 MAX(down_bps) AS max_down_bps,
                 MAX(up_bps) AS max_up_bps
          FROM client_samples
          WHERE ts BETWEEN ? AND ? AND mac = ?
          GROUP BY CAST(ts / ? AS INTEGER)
          ORDER BY ts
        `).all(bucket, bucket, from, to, mac, bucket)
      };
    }

    return {
      bucket,
      points: this.db.prepare(`
        SELECT CAST(ts / ? AS INTEGER) * ? AS ts,
               AVG(wan_down_bps) AS down_bps,
               AVG(wan_up_bps) AS up_bps,
               MAX(wan_down_bps) AS max_down_bps,
               MAX(wan_up_bps) AS max_up_bps,
               AVG(online_count) AS online_count
        FROM samples
        WHERE ts BETWEEN ? AND ?
        GROUP BY CAST(ts / ? AS INTEGER)
        ORDER BY ts
      `).all(bucket, bucket, from, to, bucket)
    };
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
      down: topUsage(rows, 'down_bytes', limit),
      up: topUsage(rows, 'up_bytes', limit)
    };
  }
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
