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

await testRouterClientPasswordLogin();

console.log('Smoke test passed');

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
