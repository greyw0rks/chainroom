import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { root, settings } from './lib/switch.mjs';

const env = await settings();
const checks = [
  ['switch', `http://127.0.0.1:${env.API_HOST_PORT || '8000'}/health/ready`],
  ['gateway', `http://127.0.0.1:${env.GATEWAY_HOST_PORT || '8080'}/`],
  ['mattermost', `http://127.0.0.1:${env.MATTERMOST_HOST_PORT || '8065'}/api/v4/system/ping`],
];
const services = await Promise.all(checks.map(async ([service, url]) => {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const result = { service, url, status: response.status, ready: response.ok };
    if (service === 'switch' && response.ok) {
      const body = await response.json();
      result.ready = body.status === 'ready';
    }
    if (service === 'mattermost' && response.ok) {
      const body = await response.json();
      result.ready = body.status === 'OK';
    }
    return result;
  } catch (error) {
    return { service, url, ready: false, error: error.name === 'TimeoutError' ? 'timeout' : 'unreachable' };
  }
}));
const evidence = { checked_at: new Date().toISOString(), ready: services.every(service => service.ready), services };
await mkdir(resolve(root, '.runtime/evidence'), { recursive: true, mode: 0o700 });
await writeFile(resolve(root, '.runtime/evidence/stack-health.json'), JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify(evidence, null, 2));
if (!evidence.ready) process.exitCode = 1;
