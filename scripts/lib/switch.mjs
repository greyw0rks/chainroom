import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export async function settings() {
  const env = Object.fromEntries((await readFile(resolve(root, '.env'), 'utf8')).trim().split('\n')
    .filter(line => line && !line.startsWith('#')).map(line => {
      const index = line.indexOf('=');
      return [line.slice(0,index), line.slice(index+1)];
    }));
  return env;
}
export async function connect() {
  const env = await settings();
  const base = `http://127.0.0.1:${env.API_HOST_PORT || '8000'}/gateway`;
  const response = await fetch(base+'/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: env.GATEWAY_ADMIN_EMAIL, password: env.GATEWAY_ADMIN_PASSWORD }),
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`Local Switch login failed: HTTP ${response.status}`);
  const cookie = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  if (!cookie) throw new Error('Switch returned no authenticated session cookie');
  const user = await response.json();
  return { user, request: async (path, body, options = {}) => {
    const response = await fetch(base+path, {
      method: options.method ?? (body === undefined ? 'GET' : 'POST'),
      headers: { cookie, 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(45000)
    });
    if (!response.ok) {
      // Error payloads can include submitted settings. Keep them private.
      throw new Error(`Switch ${path} failed: HTTP ${response.status}`);
    }
    if (response.status === 204) return null;
    const text = await response.text();
    return text.trim() ? JSON.parse(text) : null;
  }};
}
