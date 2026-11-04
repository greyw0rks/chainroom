import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { root, connect } from './lib/switch.mjs';
import { connectMattermost } from './lib/mattermost.mjs';

const command = process.argv[2];
if (!['status', 'enroll', 'smoke', 'provision', 'access', 'link', 'instructions'].includes(command)) {
  throw new Error('Usage: node scripts/setup-switch.mjs status|enroll|smoke|provision|access');
}
const { user, request } = await connect();
if (command === 'instructions') {
  const provision = JSON.parse(await readFile(resolve(root, '.runtime/provisioned.json'), 'utf8'));
  const parsed = spawnSync('python3', ['-c', 'import json,sys,yaml;print(json.dumps(yaml.safe_load(open(sys.argv[1]))["room"]["instructions"]))', resolve(root, 'templates/chainroom.template.yaml')], { encoding: 'utf8' });
  if (parsed.status !== 0) throw new Error('Could not read room instructions.');
  await request(`/rooms/${provision.room.room_id}`, { instructions: JSON.parse(parsed.stdout) }, { method: 'PATCH' });
  console.log('Updated the live room instructions from the checked-in template.');
}
if (command === 'link') {
  const mm = await connectMattermost();
  const identities = await request('/auth/me/identities');
  const bridges = await request('/collaborations');
  const bridge = (Array.isArray(bridges) ? bridges : bridges.bridges).find(b => (b.type ?? b.bridge_type) === 'mattermost');
  if (!bridge) throw new Error('No local Mattermost bridge is available.');
  const bridgeId = bridge.id ?? bridge.bridge_id;
  if (!(Array.isArray(identities) ? identities : identities.identities).some(i => i.external_user_id === mm.user.id)) {
    const claim = await request(`/collaborations/${bridgeId}/identities`, {
      external_user_id: mm.user.id, username: mm.user.username, expects_confirmation: true
    });
    const linked = await request('/auth/me/identities');
    if (!(Array.isArray(linked) ? linked : linked.identities).some(i => i.external_user_id === mm.user.id)) {
      await request(`/collaborations/${bridgeId}/identities/${claim.id}/verify-session`, { token: mm.token });
    }
  }
  console.log('Mattermost account identity verified using its own authenticated session.');
}
if (command === 'access') {
  const name = process.argv[3] === 'full' ? 'provisioned.json' : 'smoke-provisioned.json';
  const result = JSON.parse(await readFile(resolve(root, '.runtime', name), 'utf8'));
  await request(`/chats/${encodeURIComponent(result.room.room_id)}/members`, { userId: user.id });
  const mm = await connectMattermost();
  await request(`/rooms/${encodeURIComponent(result.room.room_id)}/users`, { user_names: [mm.user.username] });
  console.log('The authenticated builder now has Gateway membership in the provisioned room.');
}
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
  const mm = await connectMattermost();
  const record = resolve(root, '.runtime', smoke ? 'smoke-provisioned.json' : 'provisioned.json');
  const body = {
    template: await readFile(resolve(root, 'templates', smoke ? 'connection-check.template.yaml' : 'chainroom.template.yaml'), 'utf8'),
    template_name: smoke ? 'Chainroom connection check' : 'Chainroom engineering incident room',
    inputs: {
      workspace_root: resolve(root, '.runtime/workspaces'),
      builder_username: mm.user.username,
      ...(smoke ? {} : { repository: resolve(root, '.runtime/demo-repo') })
    }
  };
  try { await access(record); throw new Error('A provisioning record already exists. Inspect it before creating another room.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const result = await request('/rooms/from-template-document', body);
  if (!result.room?.room_id || result.failed_attachments?.length || result.room.failed_attachments?.length || !result.created_agents?.length) {
    await writeFile(record + '.failed', JSON.stringify(result, null, 2) + '\n', { mode: 0o600 });
    throw new Error('Switch did not complete room provisioning; inspect the private failed record.');
  }
  await writeFile(record, JSON.stringify(result, null, 2)+'\n', { mode: 0o600 });
  await request(`/chats/${encodeURIComponent(result.room.room_id)}/members`, { userId: user.id });
  console.log(`Switch returned a provisioning result. Inspect ${record} before declaring the agents and room ready.`);
}
