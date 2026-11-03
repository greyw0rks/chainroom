import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { root, connect } from './lib/switch.mjs';

const command = process.argv[2];
if (!['status', 'enroll', 'smoke', 'provision'].includes(command)) {
  throw new Error('Usage: node scripts/setup-switch.mjs status|enroll|smoke|provision');
}
const { request } = await connect();
if (command === 'status') {
  const controllers = await request('/management/controllers');
  // Do not print controller tokens, enrollment codes or provider settings.
  await mkdir(resolve(root, '.runtime'), { recursive: true, mode: 0o700 });
  await writeFile(resolve(root, '.runtime/controllers.json'), JSON.stringify(controllers, null, 2), { mode: 0o600 });
  console.log('Authenticated Switch access succeeded. Machine status saved privately to .runtime/controllers.json.');
}
if (command === 'enroll') {
  try {
    await access(resolve(root, '.runtime/controller/controller.db'));
    throw new Error('Controller already has local state; use its status/doctor before attempting enrollment again.');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const enrollment = await request('/management/enrollment-codes', {});
  const result = spawnSync(resolve(root, '.tools/controller/bin/switch-agent-controller'), [
    'enroll', '--server', 'http://127.0.0.1:8000', '--code', enrollment.code,
    '--name', 'chainroom-debian', '--description', 'Chainroom solo build: existing Codex in Debian/WSL',
    '--data-dir', resolve(root, '.runtime/controller')
  ], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Controller enrollment failed (exit ${result.status}); inspect local controller status.`);
  console.log('Enrolled chainroom-debian. Start the controller with its run command.');
}
if (command === 'smoke' || command === 'provision') {
  const smoke = command === 'smoke';
  const record = resolve(root, '.runtime', smoke ? 'smoke-provisioned.json' : 'provisioned.json');
  const body = {
    template: await readFile(resolve(root, 'templates', smoke ? 'connection-check.template.yaml' : 'chainroom.template.yaml'), 'utf8'),
    template_name: smoke ? 'Chainroom connection check' : 'Chainroom engineering incident room',
    inputs: {
      workspace_root: resolve(root, '.runtime/workspaces'),
      ...(smoke ? {} : { repository: resolve(root, '.runtime/demo-repo') })
    }
  };
  try { await access(record); throw new Error('A provisioning record already exists. Inspect it before creating another room.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const result = await request('/rooms/from-template-document', body);
  await writeFile(record, JSON.stringify(result, null, 2)+'\n', { mode: 0o600 });
  console.log(`Switch returned a provisioning result. Inspect ${record} before declaring the agents and room ready.`);
}
