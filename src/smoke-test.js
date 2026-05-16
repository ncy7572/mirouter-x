import { Store } from './db.js';

const store = new Store(':memory:');
store.saveSnapshot({
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

console.log('Smoke test passed');
