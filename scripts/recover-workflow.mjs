import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { connect, root } from './lib/switch.mjs';

const { request } = await connect();
const provision = JSON.parse(await readFile(resolve(root, '.runtime/provisioned.json'), 'utf8'));
const room = provision.room.room_id;
const triage = provision.created_agents.find(a => a.name === 'chainroom-triage')?.agent_id;
if (!triage) throw new Error('The provisioned Triage identity is unavailable.');
const command = process.argv[2];
if (!['reset', 'retry', 'continue'].includes(command)) throw new Error('Usage: recover-workflow.mjs reset|retry|continue');
const messages = (await request(`/chats/${room}/messages?limit=200`)).messages;
const report = messages.find(m => m.sender.kind === 'human' && m.body.includes('Controlled demo regression'));
if (!report) throw new Error('The original human incident report is unavailable.');
const result = command === 'continue' ? await request(`/chats/${room}/messages`, {
  requestId: randomUUID(), threadRootId: report.messageId, uploadIds: [], mentionAgentId: triage,
  body: 'Controller recovery requested by the builder: continue CR-001 from the original human report in this thread. Read the report, follow the room instructions, and delegate through Switch. Keep all incident handoffs and evidence in this original thread. This is an operational continuation, not a new incident or approval.'
}) : await request(`/chats/${room}/controls`, {
  requestId: randomUUID(), agentId: triage, command,
  ...(command === 'retry' ? { messageId: report.messageId } : {})
});
console.log(JSON.stringify({ room_id: room, report_id: report.messageId, command, result }));
