import { settings } from './switch.mjs';

export async function connectMattermost() {
  const env = await settings();
  const base = `http://127.0.0.1:${env.MATTERMOST_HOST_PORT || '8065'}/api/v4`;
  const login = await fetch(base + '/users/login', { method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ login_id: env.MATTERMOST_USER, password: env.MATTERMOST_USER_PASSWORD }),
    signal: AbortSignal.timeout(10000) });
  if (!login.ok) throw new Error(`Mattermost login failed: ${login.status}`);
  const token = login.headers.get('token');
  const user = await login.json();
  if (!token) throw new Error('Mattermost returned no session token.');
  return { user, token, request: async path => {
    const response = await fetch(base + path, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Mattermost read failed: ${response.status}`);
    return response.json();
  } };
}
