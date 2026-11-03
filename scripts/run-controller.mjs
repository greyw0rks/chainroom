import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { dirname, resolve, delimiter } from 'node:path';
import { root } from './lib/switch.mjs';

const migratedRtk = resolve(root, '../ubuntu-to-debian-migration/bin/rtk');
const env = { ...process.env };
try {
  await access(migratedRtk);
  env.PATH = dirname(migratedRtk)+delimiter+(env.PATH ?? '');
} catch {}
// Inherit the existing provider credential without printing or copying it.
const child = spawn(resolve(root, '.tools/controller/bin/switch-agent-controller'), [
  'run', '--data-dir', resolve(root, '.runtime/controller')
], { env, stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
