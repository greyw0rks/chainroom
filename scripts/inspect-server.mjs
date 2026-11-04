import { writeFile } from 'node:fs/promises';
import { settings } from './lib/switch.mjs';

const env = await settings();
const base = `http://127.0.0.1:${env.API_HOST_PORT || '8000'}`;
const login = await fetch(base + '/gateway/auth/login', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: env.GATEWAY_ADMIN_EMAIL, password: env.GATEWAY_ADMIN_PASSWORD }),
  signal: AbortSignal.timeout(15000)
});
if (!login.ok) throw new Error(`Switch login failed: ${login.status}`);
const cookie = login.headers.getSetCookie().map(v => v.split(';')[0]).join('; ');
const response = await fetch(base + '/openapi.json', { headers: { cookie }, signal: AbortSignal.timeout(15000) });
if (!response.ok) throw new Error(`Switch contract unavailable: ${response.status}`);
const contract = await response.json();
await writeFile('/tmp/chainroom-openapi.json', JSON.stringify(contract), { mode: 0o600 });
console.log(JSON.stringify(Object.entries(contract.paths).filter(([p]) => /session|command|management|agent/.test(p)).map(([path, methods]) => ({ path, methods: Object.keys(methods) })), null, 2));
