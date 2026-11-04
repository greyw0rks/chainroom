import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { root } from './lib/switch.mjs';
import { connectMattermost } from './lib/mattermost.mjs';
const { user, request } = await connectMattermost();
const bot = await request('/users/username/chainroom-connection-check');
if (!bot.is_bot) throw new Error('The connection-check account is not a Mattermost bot.');
const teams = await request(`/users/${user.id}/teams`);
let evidence;
for (const team of teams) {
  const channels = await request(`/users/${user.id}/teams/${team.id}/channels`);
  for (const channel of channels) {
    const page = await request(`/channels/${channel.id}/posts?per_page=100`);
    const posts = page.order.map(id => page.posts[id]).sort((a, b) => a.create_at - b.create_at);
    const report = posts.find(p => p.user_id === user.id && p.message.includes('staking dashboard'));
    if (!report) continue;
    const response = posts.find(p => p.user_id === bot.id && p.create_at > report.create_at && p.message.includes('Recommended next action'));
    if (response) evidence = { checked_at: new Date().toISOString(), ready: true, channel_id: channel.id,
      channel_name: channel.name, actual_human_account: user.id, actual_bot_account: bot.id, report, response,
      same_channel: true, same_thread: response.root_id === (report.root_id || report.id),
      note: 'Actual Mattermost report and Codex response through Switch. The initial substantive response was top-level in Town Square; strict thread routing is required for the full workflow.' };
  }
}
if (!evidence) throw new Error('No real connection-check report and substantive response were found.');
await mkdir(resolve(root, '.runtime/evidence'), { recursive: true, mode: 0o700 });
await writeFile(resolve(root, '.runtime/evidence/connection.json'), JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify({ ready: evidence.ready, channel: evidence.channel_name, report_id: evidence.report.id,
  response_id: evidence.response.id, same_channel: evidence.same_channel, same_thread: evidence.same_thread }));
