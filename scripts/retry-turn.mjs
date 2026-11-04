import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { connect } from './lib/switch.mjs';
import { workflowRetries, retryWorkflow } from './lib/retry.mjs';
const provision = JSON.parse(await readFile(new URL('../.runtime/provisioned.json', import.meta.url), 'utf8'));
const roomId = provision.room.room_id;
const { user, request } = await connect();
const messages = (await request(`/chats/${roomId}/messages?limit=200`)).messages;
const report = messages.find(m => m.sender.kind === 'human' && m.body.includes('Controlled demo regression'));
const threadId = report.threadRootId ?? report.messageId;
const candidates = await workflowRetries({ provision, roomId, threadId });
const role = process.argv[2];
if (!role) { console.log(JSON.stringify(candidates, null, 2)); }
else {
  const candidate = candidates.find(turn => turn.role === role);
  if (!candidate?.retryable) throw new Error('There is no failed turn to retry for this role.');
  const receipt = await retryWorkflow({ provision, roomId, threadId, role, messageId: candidate.message_id,
    requestId: randomUUID(), model: process.argv[3], user, request });
  console.log(JSON.stringify({ role, message_id: candidate.message_id, receipt }, null, 2));
}
