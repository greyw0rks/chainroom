import { connectMattermost } from './lib/mattermost.mjs';

const { user, request } = await connectMattermost();
const teams = await request(`/users/${user.id}/teams`);
for (const team of teams) {
  const channels = await request(`/users/${user.id}/teams/${team.id}/channels`);
  console.log(JSON.stringify({ team: team.name, channels: channels.map(c => ({ name: c.name, display: c.display_name, id: c.id })) }));
  for (const channel of channels) {
    const page = await request(`/channels/${channel.id}/posts?per_page=20`);
    console.log(JSON.stringify({ channel: channel.name, display: channel.display_name, id: channel.id,
      posts: page.order.map(id => page.posts[id]).map(p => ({ id: p.id, actor: p.user_id,
        builder: p.user_id === user.id, thread: p.root_id, message: p.message })) }, null, 2));
  }
}
