export class RouterClient {
  constructor({ host, stok, timeoutMs = 6000 }) {
    this.host = host;
    this.stok = stok;
    this.timeoutMs = timeoutMs;
  }

  url(path) {
    const cleanPath = path.replace(/^\/+/, '');
    if (cleanPath.startsWith('api/xqsystem/init_info')) {
      return `http://${this.host}/cgi-bin/luci/${cleanPath}`;
    }
    return `http://${this.host}/cgi-bin/luci/;stok=${this.stok}/${cleanPath}`;
  }

  async get(path) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(this.url(path), { signal: controller.signal });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`Router returned HTTP ${response.status}`);
      }
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`Router returned non-JSON response for ${path}`);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  async snapshot() {
    if (!this.stok) {
      throw new Error('MIROUTER_STOK is not configured');
    }

    const [status, devices, topo, wan, wifi] = await Promise.all([
      this.get('api/misystem/status'),
      this.get('api/misystem/devicelist'),
      this.get('api/misystem/topo_graph'),
      this.get('api/xqnetwork/get_wan_status'),
      this.get('api/xqnetwork/wifi_detail_all')
    ]);

    if (status.code !== 0) {
      throw new Error(status.msg || `Router status failed with code ${status.code}`);
    }

    return { status, devices, topo, wan, wifi };
  }
}
