import { createServer } from 'node:http';
import { existsSync, createReadStream } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { config } from './config.js';
import { Store } from './db.js';
import { RouterClient } from './router-client.js';

const publicDir = resolve(process.cwd(), 'public');
const store = new Store(config.dbPath);
const router = new RouterClient(config);
const state = {
  collecting: false,
  lastError: '',
  lastCollectedAt: 0
};

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8'
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  res.end(body);
}

function parseUrl(req) {
  return new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
}

function parseTimeRange(url) {
  const now = Math.floor(Date.now() / 1000);
  const range = url.searchParams.get('range') || '15m';
  const ranges = {
    '15m': 900,
    '1h': 3600,
    '6h': 21600,
    '1d': 86400,
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

async function collect() {
  if (state.collecting) return;
  state.collecting = true;
  try {
    const snapshot = await router.snapshot();
    const ts = store.saveSnapshot(snapshot);
    store.cleanup(config.retentionDays);
    state.lastCollectedAt = ts;
    state.lastError = '';
  } catch (error) {
    state.lastError = error.message;
  } finally {
    state.collecting = false;
  }
}

function handleApi(req, res, url) {
  if (url.pathname === '/api/summary') {
    sendJson(res, 200, {
      ...store.summary(),
      collector: state,
      settings: {
        host: config.host,
        pollSeconds: config.pollSeconds,
        retentionDays: config.retentionDays,
        hasToken: Boolean(config.stok)
      }
    });
    return true;
  }

  if (url.pathname === '/api/clients') {
    sendJson(res, 200, { clients: store.clients() });
    return true;
  }

  if (url.pathname === '/api/series') {
    const { from, to } = parseTimeRange(url);
    const maxPoints = Number.parseInt(url.searchParams.get('maxPoints') || '900', 10);
    const mac = url.searchParams.get('mac') || '';
    sendJson(res, 200, store.series({
      from,
      to,
      maxPoints: Number.isFinite(maxPoints) ? maxPoints : 900,
      mac
    }));
    return true;
  }

  if (url.pathname === '/api/usage') {
    const { from, to } = parseTimeRange(url);
    sendJson(res, 200, store.usage({ from, to, limit: 9 }));
    return true;
  }

  if (url.pathname === '/api/collect' && req.method === 'POST') {
    collect().then(() => sendJson(res, 200, { ok: !state.lastError, collector: state }));
    return true;
  }

  return false;
}

function serveStatic(req, res, url) {
  const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = resolve(publicDir, `.${pathname}`);
  if (!filePath.startsWith(publicDir) || !existsSync(filePath)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  res.writeHead(200, { 'content-type': mime[extname(filePath)] || 'application/octet-stream' });
  createReadStream(filePath).pipe(res);
}

const server = createServer((req, res) => {
  const url = parseUrl(req);
  if (url.pathname.startsWith('/api/') && handleApi(req, res, url)) return;
  serveStatic(req, res, url);
});

server.listen(config.port, '127.0.0.1', () => {
  console.log(`Mirouter X dashboard: http://127.0.0.1:${config.port}`);
  collect();
  setInterval(collect, config.pollSeconds * 1000).unref();
});
