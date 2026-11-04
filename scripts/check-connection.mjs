import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { connect, root } from './lib/switch.mjs';

const provision = JSON.parse(await readFile(resolve(root, '.runtime/smoke-provisioned.json'), 'utf8'));
const roomId = provision.room.room_id;
const agentId = provision.created_agents[0].agent_id;
const { request } = await connect();
const page = await request(`/chats/${encodeURIComponent(roomId)}/messages?limit=100`);
const messages = page.messages;
const report = messages.filter(m => m.sender.kind === 'human' && m.body.includes('staking dashboard')).at(-1);
const replies = report ? messages.filter(m => m.seq > report.seq && m.sender.agentId === agentId) : [];
const substantive = replies.filter(m => !m.body.startsWith('Starting a session') && !m.body.startsWith('I finished without replying.'));
const result = { checked_at: new Date().toISOString(), ready: !!report && substantive.length > 0,
  room_id: roomId, report, replies };
await mkdir(resolve(root, '.runtime/evidence'), { recursive: true, mode: 0o700 });
await writeFile(resolve(root, '.runtime/evidence/connection.json'), JSON.stringify(result, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify({ ready: result.ready, room_id: roomId,
  recent_messages: messages.slice(-8).map(m => ({ id: m.messageId, sender: m.sender, source: m.source, body: m.body })),
  report: report && { id: report.messageId, source: report.source, actor: report.sender.userId },
  replies: replies.map(m => ({ id: m.messageId, thread: m.threadRootId, body: m.body })) }, null, 2));
if (!result.ready) process.exitCode = 1;
