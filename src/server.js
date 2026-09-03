import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { extname, relative, resolve, sep } from 'node:path';
import { brotliCompressSync, constants as zlibConstants, gzipSync } from 'node:zlib';
import { config } from './config.js';
import { Store } from './db.js';
import { RouterClient } from './router-client.js';
import { logError, logInfo } from './logger.js';

const publicDir = resolve(process.cwd(), 'public');
const store = new Store(config.dbPath);
const router = new RouterClient(config);
const state = {
  collecting: false,
  lastError: '',
  lastCollectedAt: 0
};
const maxChartPoints = 1500;
const sseClients = new Set();
const timers = [];
let pollTimer = null;
let consecutiveFailures = 0;
let lastCleanupAt = 0;
let shuttingDown = false;

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8'
};

function sendJson(req, res, status, payload) {
  const body = Buffer.from(JSON.stringify(payload));
  const { body: responseBody, encoding } = compressBody(req, body);
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': responseBody.length,
    vary: 'Accept-Encoding'
  };
  if (encoding) headers['content-encoding'] = encoding;
  res.writeHead(status, headers);
  res.end(responseBody);
}

const COMPRESSION_CACHE_LIMIT = 16;
const compressionCache = new Map();

function compressBody(req, body) {
  if (body.length < 1024) return { body, encoding: '' };

  const acceptEncoding = req.headers['accept-encoding'] || '';
  let encoding = '';
  if (/\bbr\b/.test(acceptEncoding)) encoding = 'br';
  else if (/\bgzip\b/.test(acceptEncoding)) encoding = 'gzip';
  if (!encoding) return { body, encoding: '' };

  const key = body.toString('utf8');
  let entry = compressionCache.get(key);
  if (entry) {
    compressionCache.delete(key);
    compressionCache.set(key, entry);
  } else {
    entry = {
      br: brotliCompressSync(body, {
        params: {
          [zlibConstants.BROTLI_PARAM_QUALITY]: 4
        }
      }),
      gzip: gzipSync(body, { level: 6 })
    };
    compressionCache.set(key, entry);
    if (compressionCache.size > COMPRESSION_CACHE_LIMIT) {
      compressionCache.delete(compressionCache.keys().next().value);
    }
  }
  return { body: entry[encoding], encoding };
}

function parseUrl(req) {
  return new URL(req.url || '/', 'http://127.0.0.1');
}

function parseTimeRange(url) {
  const now = Math.floor(Date.now() / 1000);
  const range = url.searchParams.get('range') || '15m';
  const ranges = {
    '15m': 900,
    '1h': 3600,
    '1d': 86400,
    '7d': 604800,
    '30d': 2592000
  };
  const requestedFrom = Number.parseInt(url.searchParams.get('from') || '', 10);
  const requestedTo = Number.parseInt(url.searchParams.get('to') || '', 10);
  const hasCustomRange = Number.isFinite(requestedFrom) && Number.isFinite(requestedTo) && requestedTo > requestedFrom;
  const seconds = ranges[range] ?? ranges['15m'];
  return {
    from: hasCustomRange ? requestedFrom : now - seconds,
    to: hasCustomRange ? requestedTo : now,
    range
  };
}

function buildSummaryPayload() {
  return {
    ...store.summary(),
    database: {
      sizeBytes: store.sizeBytes()
    },
    collector: state,
    settings: {
      host: config.host,
      pollSeconds: config.pollSeconds,
      retentionDetDays: config.retentionDetDays,
      retentionAggDays: config.retentionAggDays,
      ...router.authState()
    }
  };
}

function formatSnapshotEvent() {
  return `event: snapshot\ndata: ${JSON.stringify(buildSummaryPayload())}\n\n`;
}

function broadcastSnapshot() {
  if (sseClients.size === 0) return;
  let data;
  try {
    data = formatSnapshotEvent();
  } catch (error) {
    logError(`[Mirouter X] broadcast failed: ${error.message}`);
    return;
  }
  for (const res of sseClients) {
    try {
      res.write(data);
    } catch {
      sseClients.delete(res);
      res.destroy();
    }
  }
}

async function collect() {
  if (state.collecting) return;
  state.collecting = true;
  try {
    const snapshot = await router.snapshot();
    const ts = store.queueSnapshot(snapshot);
    if (Date.now() - lastCleanupAt >= 60 * 60 * 1000) {
      lastCleanupAt = Date.now();
      store.cleanup(config.retentionDetDays, config.retentionAggDays);
      store.checkpoint();
    }
    state.lastCollectedAt = ts;
    state.lastError = '';
    consecutiveFailures = 0;
  } catch (error) {
    state.lastError = error.message;
    consecutiveFailures += 1;
    logError(`[Mirouter X] collect failed: ${error.message}`);
  } finally {
    state.collecting = false;
    broadcastSnapshot();
  }
}

function scheduleCollect() {
  if (shuttingDown) return;
  const delaySeconds = consecutiveFailures === 0
    ? config.pollSeconds
    : Math.min(config.pollSeconds * 2 ** consecutiveFailures, 300);
  pollTimer = setTimeout(() => {
    collect().finally(scheduleCollect);
  }, delaySeconds * 1000);
  pollTimer.unref();
}

function flushWrites() {
  try {
    store.flush();
  } catch (error) {
    logError(`[Mirouter X] flush failed: ${error.message}`);
  }
}

function isAuthorized(req, url) {
  if (!config.accessToken) return true;
  if (req.headers.authorization === `Bearer ${config.accessToken}`) return true;
  return url.searchParams.get('token') === config.accessToken;
}

function handleApi(req, res, url) {
  if (url.pathname === '/api/health') {
    sendJson(req, res, 200, { ok: true });
    return true;
  }

  if (!isAuthorized(req, url)) {
    sendJson(req, res, 401, { error: 'unauthorized' });
    return true;
  }

  if (url.pathname === '/api/summary') {
    sendJson(req, res, 200, buildSummaryPayload());
    return true;
  }

  if (url.pathname === '/api/events') {
    handleEvents(req, res);
    return true;
  }

  if (url.pathname === '/api/clients') {
    sendJson(req, res, 200, { clients: store.clients() });
    return true;
  }

  if (url.pathname === '/api/series') {
    const { from, to } = parseTimeRange(url);
    const maxPoints = Number.parseInt(url.searchParams.get('maxPoints') || '900', 10);
    const mac = url.searchParams.get('mac') || '';
    sendJson(req, res, 200, store.series({
      from,
      to,
      maxPoints: Number.isFinite(maxPoints) ? Math.min(Math.max(maxPoints, 1), maxChartPoints) : 900,
      mac
    }));
    return true;
  }

  if (url.pathname === '/api/usage') {
    const { from, to } = parseTimeRange(url);
    sendJson(req, res, 200, store.usage({ from, to, limit: 9 }));
    return true;
  }

  if (url.pathname === '/api/monthly') {
    const now = Math.floor(Date.now() / 1000);
    const month = url.searchParams.get('month') || utcMonth(now);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      sendJson(req, res, 400, { error: 'invalid month; expected YYYY-MM' });
      return true;
    }
    const [year, monthNumber] = month.split('-').map(Number);
    const from = Math.floor(Date.UTC(year, monthNumber - 1, 1) / 1000);
    const end = Math.floor(Date.UTC(year, monthNumber, 1) / 1000) - 1;
    const complete = end < now;
    const to = complete ? end : now;
    const { days, clients } = store.monthly(from, to);
    const totals = days.reduce(
      (sum, day) => ({
        down_bytes: sum.down_bytes + day.down_bytes,
        up_bytes: sum.up_bytes + day.up_bytes
      }),
      { down_bytes: 0, up_bytes: 0 }
    );
    sendJson(req, res, 200, { month, from, to, complete, totals, days, clients });
    return true;
  }

  if (url.pathname === '/api/collect' && req.method === 'POST') {
    collect().then(() => sendJson(req, res, 200, { ok: !state.lastError, collector: state }));
    return true;
  }

  return false;
}

function utcMonth(ts) {
  const date = new Date(ts * 1000);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function handleEvents(req, res) {
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-store',
    connection: 'keep-alive'
  });
  try {
    res.write(formatSnapshotEvent());
  } catch {
    res.destroy();
    return;
  }
  sseClients.add(res);
  const pingTimer = setInterval(() => {
    res.write(': ping\n\n');
  }, 25 * 1000);
  pingTimer.unref();
  const drop = () => {
    clearInterval(pingTimer);
    sseClients.delete(res);
  };
  res.on('close', drop);
  res.on('error', drop);
}

const staticCache = new Map();

function staticEntry(filePath) {
  let stat;
  try {
    stat = statSync(filePath);
  } catch {
    return null;
  }
  if (!stat.isFile()) return null;
  const cached = staticCache.get(filePath);
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) return cached;
  const content = readFileSync(filePath);
  const entry = {
    mtimeMs: stat.mtimeMs,
    size: stat.size,
    content,
    br: brotliCompressSync(content, {
      params: {
        [zlibConstants.BROTLI_PARAM_QUALITY]: 4
      }
    }),
    gzip: gzipSync(content, { level: 6 }),
    etag: `"${Math.round(stat.mtimeMs).toString(36)}-${stat.size.toString(36)}"`
  };
  staticCache.set(filePath, entry);
  return entry;
}

function serveStatic(req, res, url) {
  const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = resolve(publicDir, `.${pathname}`);
  const fileRelativePath = relative(publicDir, filePath);
  const entry = fileRelativePath.startsWith('..') || fileRelativePath.includes(`..${sep}`) || fileRelativePath === ''
    ? null
    : staticEntry(filePath);
  if (!entry) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  const headers = {
    'content-type': mime[extname(filePath)] || 'application/octet-stream',
    'cache-control': 'no-cache',
    etag: entry.etag,
    vary: 'Accept-Encoding'
  };
  if (req.headers['if-none-match'] === entry.etag) {
    res.writeHead(304, headers);
    res.end();
    return;
  }
  const acceptEncoding = req.headers['accept-encoding'] || '';
  let body = entry.content;
  if (/\bbr\b/.test(acceptEncoding)) {
    body = entry.br;
    headers['content-encoding'] = 'br';
  } else if (/\bgzip\b/.test(acceptEncoding)) {
    body = entry.gzip;
    headers['content-encoding'] = 'gzip';
  }
  headers['content-length'] = body.length;
  res.writeHead(200, headers);
  res.end(body);
}

const server = createServer((req, res) => {
  const url = parseUrl(req);
  if (url.pathname.startsWith('/api/') && handleApi(req, res, url)) return;
  serveStatic(req, res, url);
});

server.listen(config.port, config.listenHost, () => {
  logInfo(`Mirouter X dashboard: http://${config.listenHost}:${config.port}`);
  store.cleanup(config.retentionDetDays, config.retentionAggDays);
  store.checkpoint();
  lastCleanupAt = Date.now();
  collect().finally(scheduleCollect);
  store.rollup();
  timers.push(setInterval(flushWrites, 5000));
  timers.push(setInterval(() => store.rollup(), 60 * 1000));
  if (config.logSummaryMinutes > 0) {
    timers.push(setInterval(logApiSummary, config.logSummaryMinutes * 60 * 1000));
  }
  for (const timer of timers) timer.unref();
});

function closeStore() {
  try {
    store.close();
  } catch (error) {
    logError(`[Mirouter X] store close failed: ${error.message}`);
  }
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  logInfo('[Mirouter X] shutting down');
  if (pollTimer) clearTimeout(pollTimer);
  for (const timer of timers) clearInterval(timer);
  for (const res of sseClients) res.destroy();
  sseClients.clear();
  closeStore();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function logApiSummary() {
  const stats = router.consumeApiStats();
  logInfo(`[Mirouter X] API summary (${config.logSummaryMinutes}m): ${stats.success} success, ${stats.failed} failed`);
}
