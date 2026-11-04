import { connect } from './lib/switch.mjs';
const { user, request } = await connect();
console.log(JSON.stringify({ user: { id: user.id, name: user.name } }));
console.log(JSON.stringify({ identities: await request('/auth/me/identities') }));
console.log(JSON.stringify({ platformUsers: await request('/collaborations/d01cf027-bb14-4c7e-a693-65228d12a223/users') }));
const bs = await request('/collaborations');
console.log(JSON.stringify({ bridges: (Array.isArray(bs) ? bs : bs.bridges ?? []).map(b => ({ id: b.id, type: b.type, bridge_type: b.bridge_type, display_name: b.display_name })) }));
const data = await request('/rooms');
const rooms = Array.isArray(data) ? data : data.rooms ?? [];
console.log(JSON.stringify(rooms.map(r => ({ id: r.id, name: r.name, channel_type: r.channel_type,
  bridge_id: r.bridge_id, transport_room_id: r.transport_room_id, created_by: r.created_by,
  owner_id: r.owner_id })), null, 2));
console.log(JSON.stringify({ chats: (await request('/chats')).chats?.map(r => ({ id: r.roomId, name: r.name, members: r.memberUserIds })) }, null, 2));
