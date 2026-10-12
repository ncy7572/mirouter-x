import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Store } from './db.js';
import { RouterClient } from './router-client.js';

const store = new Store(':memory:');
store.queueSnapshot({
  status: {
    wan: { downspeed: '1200000', upspeed: '340000', download: '10', upload: '5' },
    cpu: { load: 0.12 },
    mem: { usage: 0.42 },
    count: { online: 2, all: 3 },
    hardware: { platform: 'RD08', version: '1.1.96' }
  },
  devices: {
    list: [
      {
        mac: 'AA:BB:CC:DD:EE:01',
        name: 'Laptop',
        oname: 'Laptop',
        type: 3,
        isap: 0,
        parent: '',
        online: 1,
        ip: [{ active: 1, ip: '192.168.31.10' }],
        statistics: { downspeed: '800000', upspeed: '120000', online: '100' }
      }
    ]
  },
  topo: { code: 0, graph: { name: 'test' } },
  wan: { code: 0 },
  wifi: { code: 0, info: [{ ssid: 'Demo', password: 'secret' }] }
});
store.flush();

const summary = store.summary();
const clients = store.clients();
const series = store.series({
  from: Math.floor(Date.now() / 1000) - 60,
  to: Math.floor(Date.now() / 1000) + 60,
  mac: '',
  maxPoints: 20
});

if (!summary.latest || clients.length !== 1 || series.points.length !== 1) {
  throw new Error('Smoke test failed');
}

if (JSON.stringify(summary).includes('secret')) {
  throw new Error('Sensitive Wi-Fi password was persisted');
}

testMonthly();
testSparseWrites();
testLiveBuffer();

await testRouterClientPasswordLogin();

console.log('Smoke test passed');

function testSparseWrites() {
  const snapshot = (downspeed) => ({
    status: { wan: {}, cpu: {}, mem: {}, count: { online: 1, all: 1 }, hardware: {} },
    devices: {
      list: [{
        mac: 'AA:BB:CC:DD:EE:02', name: 'Phone', oname: 'Phone', type: 1, isap: 0, parent: '',
        online: 1, ip: [{ active: 1, ip: '192.168.31.20' }],
        statistics: { downspeed, upspeed: '0', online: '10' }
      }]
    },
    topo: {}, wan: {}, wifi: {}
  });
  const countSamples = () => store.db
    .prepare("SELECT COUNT(*) AS n FROM client_samples WHERE mac = 'AA:BB:CC:DD:EE:02'").get().n;

  // identical snapshots must not write duplicate client_samples rows
  for (let i = 0; i < 3; i++) store.queueSnapshot(snapshot('500'));
  store.flush();
  if (countSamples() !== 1) throw new Error('Sparse write dedup failed');

  // sparse rows roll up with time-weighted averages clipped to the minute
  const now = Math.floor(Date.now() / 1000);
  const S = Math.floor(now / 3600) * 3600 - 300;
  const ins = store.db.prepare(
    'INSERT INTO client_samples (ts, mac, down_bps, up_bps, online_seconds, active) VALUES (?,?,?,?,?,?)'
  );
  ins.run(S + 10, 'AA:BB:CC:DD:EE:03', 100, 0, 0, 1);
  ins.run(S + 70, 'AA:BB:CC:DD:EE:03', 0, 0, 0, 1);
  store.setMeta('rl_c_1m', '0');
  store.rollup();
  const rolled = store.db
    .prepare("SELECT down_avg, down_bytes FROM client_samples_1m WHERE mac = 'AA:BB:CC:DD:EE:03' AND ts = ?")
    .get(S);
  if (!rolled || Math.round(rolled.down_avg) !== 100 || Math.round(rolled.down_bytes) !== 5000) {
    throw new Error('Time-weighted rollup failed');
  }
}

function testMonthly() {
  const now = Math.floor(Date.now() / 1000);
  const today = Math.floor(now / 86400) * 86400;
  const d1 = today - 3 * 86400;
  const d2 = today - 2 * 86400;

  store.upsertClient.run('AA:BB:CC:DD:EE:02', 'Phone', 'Phone', '192.168.31.20', 1, 0, '', now);

  const insDay = store.db.prepare('INSERT OR REPLACE INTO samples_1d (ts, down_bytes, up_bytes) VALUES (?, ?, ?)');
  insDay.run(d1 - 86400, 9999, 9999);
  insDay.run(d1, 1000, 100);
  insDay.run(d2, 2000, 200);
  const insHour = store.db.prepare('INSERT OR REPLACE INTO samples_1h (ts, down_bytes, up_bytes) VALUES (?, ?, ?)');
  insHour.run(today + 3600, 300, 30);
  insHour.run(today + 2 * 3600, 500, 50);

  const insClientDay = store.db.prepare('INSERT OR REPLACE INTO client_samples_1d (ts, mac, down_bytes, up_bytes) VALUES (?, ?, ?, ?)');
  insClientDay.run(d1, 'AA:BB:CC:DD:EE:01', 600, 60);
  insClientDay.run(d2, 'AA:BB:CC:DD:EE:01', 700, 70);
  insClientDay.run(d1, 'AA:BB:CC:DD:EE:02', 400, 40);
  insClientDay.run(d1, 'AA:BB:CC:DD:EE:03', -50, 5);
  const insClientHour = store.db.prepare('INSERT OR REPLACE INTO client_samples_1h (ts, mac, down_bytes, up_bytes) VALUES (?, ?, ?, ?)');
  insClientHour.run(today + 3600, 'AA:BB:CC:DD:EE:01', 200, 20);

  const { days, clients } = store.monthly(d1, today + 86399);

  if (days.length !== 3) throw new Error('Monthly days count mismatch');
  if (days[0].ts !== d1 || days[0].down_bytes !== 1000 || days[0].up_bytes !== 100) {
    throw new Error('Monthly 1d aggregation failed');
  }
  if (days[1].ts !== d2 || days[1].down_bytes !== 2000 || days[1].up_bytes !== 200) {
    throw new Error('Monthly 1d aggregation failed');
  }
  if (days[2].ts !== today || days[2].down_bytes !== 800 || days[2].up_bytes !== 80) {
    throw new Error('Monthly current-day 1h fill failed');
  }

  if (clients.length !== 3) throw new Error('Monthly clients count mismatch');
  const [laptop, phone, clamped] = clients;
  if (laptop.mac !== 'AA:BB:CC:DD:EE:01' || laptop.name !== 'Laptop'
    || laptop.down_bytes !== 1500 || laptop.up_bytes !== 150) {
    throw new Error('Monthly client aggregation failed');
  }
  if (phone.mac !== 'AA:BB:CC:DD:EE:02' || phone.name !== 'Phone'
    || phone.down_bytes !== 400 || phone.up_bytes !== 40) {
    throw new Error('Monthly client aggregation failed');
  }
  if (clamped.mac !== 'AA:BB:CC:DD:EE:03' || clamped.name !== 'AA:BB:CC:DD:EE:03'
    || clamped.down_bytes !== 0 || clamped.up_bytes !== 5) {
    throw new Error('Monthly negative clamp or name fallback failed');
  }

  const pastOnly = store.monthly(d1, d1 + 86399);
  if (pastOnly.days.length !== 1 || pastOnly.days[0].down_bytes !== 1000) {
    throw new Error('Monthly completed-days-only range failed');
  }
}

async function testRouterClientPasswordLogin() {
  let loginCount = 0;
  const requests = [];
  const server = createServer(async (req, res) => {
    requests.push(req.url);

    if (req.url === '/cgi-bin/luci/api/xqsystem/login') {
      loginCount += 1;
      const body = await readBody(req);
      const form = new URLSearchParams(body);
      if (
        form.get('username') !== 'admin'
        || form.get('logtype') !== '2'
        || !/^0_aa:bb:cc:dd:ee:ff_\d+_\d+$/.test(form.get('nonce') || '')
        || !/^[a-f0-9]{64}$/.test(form.get('password') || '')
      ) {
        sendTestJson(res, { code: 1, msg: 'bad login form' });
        return;
      }
      sendTestJson(res, { code: 0, token: 'fresh-token' });
      return;
    }

    if (req.url === '/cgi-bin/luci/api/xqsystem/init_info') {
      sendTestJson(res, { code: 0, newEncryptMode: 1 });
      return;
    }

    if (!req.url?.includes(';stok=fresh-token/')) {
      sendTestJson(res, { code: 401, msg: 'missing token' });
      return;
    }

    if (req.url.endsWith('/api/misystem/status')) {
      sendTestJson(res, {
        code: 0,
        wan: {},
        cpu: {},
        mem: {},
        count: {},
        hardware: {}
      });
      return;
    }
    if (req.url.endsWith('/api/misystem/devicelist')) {
      sendTestJson(res, { code: 0, list: [] });
      return;
    }
    sendTestJson(res, { code: 0 });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    const router = new RouterClient({
      host: `127.0.0.1:${port}`,
      password: 'router-password',
      nonceDeviceId: 'AA:BB:CC:DD:EE:FF',
      authKey: 'test-key'
    });
    const snapshot = await router.snapshot();
    if (snapshot.status.code !== 0 || router.authState().hasToken !== true) {
      throw new Error('Router password login test failed');
    }
    if (loginCount !== 1 || !requests.some((url) => url?.includes(';stok=fresh-token/'))) {
      throw new Error('Router password login was not exercised');
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function sendTestJson(res, payload) {
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function testLiveBuffer() {
  const store = new Store(':memory:');
  const now = Date.now;
  const start = Math.floor(now() / 60000) * 60 - 180;
  const sample = rate => ({
    status: { wan: {downspeed:rate,upspeed:10}, cpu:{},mem:{},count:{online:1,all:1},hardware:{} },
    devices: { list: [{mac:'TEST',name:'Live',oname:'Live',online:1,statistics:{downspeed:rate,upspeed:10,online:50}}] },
    wan:{},topo:{},wifi:{info:[{password:'private'}]}
  });
  try {
    Date.now = () => (start + 10) * 1000;
    store.queueSnapshot(sample(100));
    Date.now = () => (start + 70) * 1000;
    store.queueSnapshot(sample(200));
    assert.equal(store.db.prepare('SELECT COUNT(*) n FROM main.samples').get().n, 0);
    assert.equal(store.summary().latest.wan_down_bps, 200);
    assert.equal(store.summary().topClients[0].down_bps, 200);
    assert.equal(store.clients()[0].down_bps, 200);
    assert.equal(JSON.stringify(store.summary()).includes('private'), false);
    const range = {from:start,to:start+80,maxPoints:100};
    assert.equal(store.series(range).points.length, 2);
    assert.equal(store.series({...range,mac:'TEST'}).points.length, 2);
    assert.equal(store.usage(range).down.total, 8000);
    store.flush();
    assert.equal(store.series(range).points.length, 2, 'live/persisted rows must not double count');
    assert.equal(store.usage(range).down.total, 8000);
    Date.now = () => (start + 130) * 1000;
    store.queueSnapshot(sample(300));
    Date.now = now;
    store.rollup();
    assert.equal(store._writeQueue.length, 0);
    assert.equal(store.db.prepare('SELECT SUM(n) n FROM samples_1m').get().n, 3);
    assert.equal(store.db.prepare('SELECT COUNT(*) n FROM pending_samples').get().n, 1);
    assert.equal(store.db.prepare('SELECT COUNT(*) n FROM pending_client_samples').get().n, 1);
    console.log('Live buffer and flush-before-rollup tests passed');
  } finally {
    Date.now = now;
    store.close();
  }
}
