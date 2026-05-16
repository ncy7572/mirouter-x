import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadDotEnv() {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;

  const text = readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }
}

loadDotEnv();

function intEnv(name, fallback, min, max) {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

export const config = {
  host: process.env.MIROUTER_HOST || '192.168.31.1',
  stok: process.env.MIROUTER_STOK || '',
  pollSeconds: intEnv('MIROUTER_POLL_SECONDS', 30, 5, 3600),
  retentionDays: intEnv('MIROUTER_RETENTION_DAYS', 365, 1, 3650),
  port: intEnv('PORT', 3102, 1, 65535),
  dbPath: process.env.MIROUTER_DB || resolve(process.cwd(), 'data', 'mirouter.sqlite')
};
