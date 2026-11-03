import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { randomBytes, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const secret = () => randomBytes(32).toString('hex');
await mkdir(resolve(root, '.tools'), { recursive: true });
await mkdir(resolve(root, '.runtime'), { recursive: true, mode: 0o700 });
for (const role of ['triage', 'engineer', 'sentinel']) {
  await mkdir(resolve(root, '.runtime/workspaces', role), { recursive: true });
}
const compose = resolve(root, '.tools/switch-compose.yml');
try { await access(compose); } catch {
  const response = await fetch('https://raw.githubusercontent.com/sandbox-quantum/switch/switch-v0.31.0/deploy/local/standalone-docker-compose.yml');
  if (!response.ok) throw new Error(`Compose download failed: ${response.status}`);
  await writeFile(compose, await response.text());
}
const envPath = resolve(root, '.env');
try { await access(envPath); console.log('Kept existing .env credentials.'); } catch {
  const values = {
    SWITCH_VERSION: '0.31.0',
    CONTROLLER_RELEASE_VERSION: '0.31.1-dev.277.g2d72c57',
    SWITCH_BIND_ADDR: '127.0.0.1',
    API_HOST_PORT: '8000', GATEWAY_HOST_PORT: '8080',
    MATTERMOST_HOST_PORT: '8065', POSTGRES_HOST_PORT: '55432',
    DB_OWNER_USER: 'switch_owner', DB_OWNER_PASSWORD: secret(),
    DB_USER: 'switch_runtime', DB_PASSWORD: secret(), DB_NAME: 'switch',
    AGENT_REGISTRATION_TOKEN: secret(), SECRET_KEYS: `v1:${secret()}`,
    CONTROLLER_TOKEN_SECRET: secret(), FEATURE_FLAGS_ENABLED: 'agent_management',
    GATEWAY_ADMIN_EMAIL: 'builder@chainroom.local', GATEWAY_ADMIN_PASSWORD: secret(),
    FRONTEND_BASE_URL: 'http://localhost:8080', GATEWAY_PUBLIC_URL: 'http://localhost:8080',
    MATTERMOST_ADMIN_USER: 'chainroom-admin', MATTERMOST_ADMIN_PASSWORD: secret(),
    MATTERMOST_TEAM_NAME: 'chainroom', MATTERMOST_USER: 'builder', MATTERMOST_USER_PASSWORD: secret(),
    TELEMETRY_ENABLED: 'false', THIRD_PARTY_AVATARS_ENABLED: 'false'
  };
  await writeFile(envPath, Object.entries(values).map(([k,v]) => `${k}=${v}`).join('\n')+'\n', { mode: 0o600, flag: 'wx' });
  console.log('Created private .env with generated local credentials.');
}
const composeHash = createHash('sha256').update(await readFile(compose)).digest('hex');
if (composeHash !== 'cba238878078cf3d77fd9e136ef432f1ce5fd1bfe597acd172b9faa6720f0121') {
  throw new Error('Compose file does not match the reviewed Switch 0.31.0 artifact.');
}
console.log(`Compose SHA-256: ${composeHash}`);
console.log('Gateway http://localhost:8080 | Mattermost http://localhost:8065 | Switch http://localhost:8000');
