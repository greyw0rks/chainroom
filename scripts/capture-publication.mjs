import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { root, connect } from './lib/switch.mjs';
import { inspectPublication } from '../src/publication-inspection.mjs';

const receipt = JSON.parse(await readFile(resolve(root, '.runtime/evidence/publication.json'), 'utf8'));
const provision = JSON.parse(await readFile(resolve(root, '.runtime/provisioned.json'), 'utf8'));
const roomId = provision.room.room_id;
const { user, request } = await connect();
const page = await request(`/chats/${roomId}/messages?limit=200`);
const report = page.messages.find(message => message.sender.kind === 'human' && message.body.includes('Controlled demo regression'));
if (!report) throw new Error('The original incident report is unavailable.');
const threadId = report.threadRootId ?? report.messageId;
const { result, messages } = await inspectPublication({ incident: 'CR-001', roomId, threadId });
if (!result.allowed || result.commit_sha !== receipt.head_sha) throw new Error('Publication no longer matches the approved commit.');
const live = spawnSync('gh', ['pr', 'view', receipt.url, '--json', 'url,state,headRefOid,baseRefName'], { encoding: 'utf8' });
if (live.status !== 0) throw new Error('GitHub publication could not be verified.');
const pr = JSON.parse(live.stdout);
if (pr.url !== receipt.url || pr.headRefOid !== receipt.head_sha || pr.state !== 'OPEN' || pr.baseRefName !== 'main') throw new Error('The GitHub PR does not match the publication receipt.');
const body = 'CHAINROOM_PUBLICATION\n' + JSON.stringify({ incident: 'CR-001', base_sha: result.base_sha,
  commit_sha: result.commit_sha, pr_url: pr.url, github_state: pr.state,
  review_message_id: result.review_message_id, decision_message_id: result.decision_message_id,
  published_at: receipt.published_at });
const existing = messages.find(message => message.sender.kind === 'human' && message.sender.userId === user.id && message.body === body);
const sent = existing ? [existing] : (await request(`/chats/${roomId}/messages`, {
  requestId: randomUUID(), body, threadRootId: threadId, uploadIds: []
})).messages;
const record = { checked_at: new Date().toISOString(), room_id: roomId, thread_id: threadId,
  pr_url: pr.url, head_sha: pr.headRefOid, switch_message_ids: sent.map(message => message.messageId), reused: !!existing };
await writeFile(resolve(root, '.runtime/evidence/publication-record.json'), JSON.stringify(record, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify(record, null, 2));
