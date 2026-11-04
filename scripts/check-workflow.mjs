import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { connect, root } from './lib/switch.mjs';
const provision = JSON.parse(await readFile(resolve(root, '.runtime/provisioned.json'), 'utf8'));
const roomId = provision.room.room_id;
const { request } = await connect();
const page = await request(`/chats/${encodeURIComponent(roomId)}/messages?limit=200`);
await mkdir(resolve(root, '.runtime/evidence'), { recursive: true, mode: 0o700 });
await writeFile(resolve(root, '.runtime/evidence/workflow.json'), JSON.stringify({ checked_at: new Date().toISOString(), room_id: roomId, ...page }, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify({ room_id: roomId, head_seq: page.headSeq,
  messages: page.messages.slice(-12).map(m => ({ id: m.messageId, seq: m.seq, thread: m.threadRootId,
    sender: m.sender, source: m.source, body: m.body })) }, null, 2));
