import { createHash, randomBytes } from 'node:crypto';

class RouterAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RouterAuthError';
  }
}

export class RouterClient {
  constructor({
    host,
    stok,
    password,
    nonceDeviceId,
    authKey,
    timeoutMs = 6000
  }) {
    this.host = host;
    this.stok = stok;
    this.password = password;
    this.nonceDeviceId = nonceDeviceId || randomDeviceId();
    this.authKey = authKey;
    this.timeoutMs = timeoutMs;
    this.loginPromise = null;
  }

  url(path, { authenticated = true } = {}) {
    const cleanPath = path.replace(/^\/+/, '');
    if (!authenticated || cleanPath.startsWith('api/xqsystem/init_info')) {
      return `http://${this.host}/cgi-bin/luci/${cleanPath}`;
    }
    return `http://${this.host}/cgi-bin/luci/;stok=${this.stok}/${cleanPath}`;
  }

  async request(path, {
    authenticated = true,
    method = 'GET',
    body,
    retryAuth = true
  } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      if (authenticated && !this.stok) {
        await this.ensureAuthenticated();
      }

      const response = await fetch(this.url(path, { authenticated }), {
        method,
        body,
        signal: controller.signal,
        headers: body ? { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8' } : undefined
      });
      const text = await response.text();
      if (!response.ok) {
        if (authenticated && retryAuth && this.password && (response.status === 401 || response.status === 403)) {
          await this.login({ force: true });
          return this.request(path, {
            authenticated,
            method,
            body,
            retryAuth: false
          });
        }
        throw new Error(`Router returned HTTP ${response.status}`);
      }

      const payload = parseJson(text, path);
      if (authenticated && isAuthFailure(payload)) {
        if (retryAuth && this.password) {
          await this.login({ force: true });
          return this.request(path, {
            authenticated,
            method,
            body,
            retryAuth: false
          });
        }
        throw new RouterAuthError(payload.msg || 'Router authentication failed; refresh MIROUTER_STOK or set MIROUTER_PASSWORD');
      }

      return payload;
    } finally {
      clearTimeout(timer);
    }
  }

  async get(path) {
    return this.request(path);
  }

  async ensureAuthenticated() {
    if (this.stok) return;
    if (!this.password) {
      throw new RouterAuthError('MIROUTER_STOK is not configured and MIROUTER_PASSWORD is not set');
    }
    await this.login();
  }

  async login({ force = false } = {}) {
    if (this.stok && !force) return this.stok;
    if (!this.password) {
      throw new RouterAuthError('MIROUTER_PASSWORD is not configured');
    }
    if (this.loginPromise) return this.loginPromise;

    this.loginPromise = this.performLogin()
      .finally(() => {
        this.loginPromise = null;
      });
    return this.loginPromise;
  }

  async performLogin() {
    const nonce = this.createNonce();
    const passwordHash = sha1(nonce + sha1(this.password + this.authKey));
    const form = new URLSearchParams({
      username: 'admin',
      password: passwordHash,
      logtype: '2',
      nonce
    });

    const payload = await this.request('api/xqsystem/login', {
      authenticated: false,
      method: 'POST',
      body: form,
      retryAuth: false
    });

    const stok = payload.token || payload.stok;
    if (payload.code !== 0 || !stok) {
      throw new RouterAuthError(payload.msg || `Router login failed with code ${payload.code ?? 'unknown'}`);
    }

    this.stok = stok;
    return this.stok;
  }

  createNonce() {
    const deviceId = String(this.nonceDeviceId).replace(/:/g, '').toLowerCase();
    const timestamp = Math.floor(Date.now() / 1000);
    const random = Math.floor(Math.random() * 10000);
    return `0_${deviceId}_${timestamp}_${random}`;
  }

  async snapshot() {
    await this.ensureAuthenticated();

    const [status, devices, topo, wan, wifi] = await Promise.all([
      this.get('api/misystem/status'),
      this.get('api/misystem/devicelist'),
      this.get('api/misystem/topo_graph'),
      this.get('api/xqnetwork/get_wan_status'),
      this.get('api/xqnetwork/wifi_detail_all')
    ]);

    if (status.code !== 0) {
      if (isAuthFailure(status) && this.password) {
        await this.login({ force: true });
        return this.snapshot();
      }
      throw new Error(status.msg || `Router status failed with code ${status.code}`);
    }

    return { status, devices, topo, wan, wifi };
  }

  authState() {
    return {
      hasToken: Boolean(this.stok),
      canRefreshToken: Boolean(this.password)
    };
  }
}

function parseJson(text, path) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Router returned non-JSON response for ${path}`);
  }
}

function sha1(text) {
  return createHash('sha1').update(text).digest('hex');
}

function randomDeviceId() {
  return randomBytes(6).toString('hex');
}

function isAuthFailure(payload) {
  const code = Number(payload?.code);
  const message = String(payload?.msg || payload?.message || '').toLowerCase();
  return code === 401
    || code === 403
    || code === 40101
    || code === 40102
    || code === 402
    || message.includes('stok')
    || message.includes('token')
    || message.includes('auth')
    || message.includes('login');
}
