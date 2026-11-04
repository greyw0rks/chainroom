import { readFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { root } from './switch.mjs';
import { retryState } from '../../src/retry-state.mjs';
import { retrySocket } from './retry-socket.mjs';
import { providerModels } from '../../src/provider-models.mjs';

const roles = ['triage', 'engineer', 'sentinel'];
export async function workflowRetries({ provision, roomId, threadId }) {
  return Promise.all(roles.map(async role => {
    const agent = provision.created_agents.find(a => a.name === `chainroom-${role}`);
    const result = { role, agent_id: agent?.agent_id, retryable: false, status: 'waiting' };
    if (!agent || !threadId) return result;
    try {
      const placements = JSON.parse(await readFile(resolve(root, '.runtime/controller/watchers', agent.agent_id, 'placements.json'), 'utf8')).placements;
      const sessionId = Object.keys(placements).find(id => placements[id] === roomId);
      if (!sessionId) return result;
      const hash = createHash('sha256').update(sessionId).digest('hex');
      const raw = await readFile(resolve(homedir(), '.local/state/switch/sdk-sessions', hash, 'events.jsonl'), 'utf8');
      const events = raw.slice(0, raw.lastIndexOf('\n') + 1).split('\n').filter(Boolean).map(JSON.parse);
      return { ...result, ...retryState(events, { roomId, threadId }), session_hash: hash };
    } catch (error) { if (error.code === 'ENOENT') return result; throw error; }
  }));
}
export function hostRequest(hash, path, body) {
  return new Promise((resolveRequest, reject) => {
    const req = httpRequest({ socketPath: retrySocket(root, hash), path,
      method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json' }, timeout: 18000 }, res => {
      let text = '';
      res.on('data', chunk => { text += chunk; if (text.length > 8_000_000) req.destroy(new Error('Session response too large.')); });
      res.on('end', () => {
        try {
          const value = JSON.parse(text);
          if (res.statusCode >= 400) return reject(new Error(value.error ?? 'Session retry refused.'));
          resolveRequest(value);
        } catch (error) { reject(error); }
      });
    });
    req.on('error', reject); req.on('timeout', () => req.destroy(new Error('Session host did not confirm the retry.')));
    req.end(body ? JSON.stringify(body) : undefined);
  });
}
export async function retryWorkflow({ provision, roomId, threadId, role, messageId, requestId, model, user, request }) {
  if (!roles.includes(role) || !/^[a-zA-Z0-9_-]{10,100}$/.test(requestId ?? '')) throw new Error('Invalid retry request.');
  if (model && !providerModels.includes(model)) throw new Error('Choose one of the configured provider models.');
  const target = (await workflowRetries({ provision, roomId, threadId })).find(candidate => candidate.role === role);
  if (!target?.session_hash || target.message_id !== messageId) throw new Error('The failed turn changed. Refresh before retrying.');
  let snapshot;
  try { snapshot = await hostRequest(target.session_hash, '/snapshot'); }
  catch (error) {
    if (!['ENOENT', 'ECONNREFUSED'].includes(error.code)) throw error;
    await request(`/chats/${roomId}/warm`, { agentId: target.agent_id });
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      try { snapshot = await hostRequest(target.session_hash, '/snapshot'); break; }
      catch (error) { if (!['ENOENT', 'ECONNREFUSED'].includes(error.code)) throw error; }
      await delay(250);
    }
    if (!snapshot) throw new Error('Retry host is unavailable. Restart the Chainroom controller to enable native Retry.');
  }
  const previous = snapshot.commandStatuses.find(command => command.commandId === requestId);
  if (previous) return previous;
  if (!target.retryable || snapshot.turns.some(turn => ['running', 'queued'].includes(turn.status))) throw new Error('This turn is running or has already completed.');
  return hostRequest(target.session_hash, '/retry', { commandId: requestId, messageId, model, actorId: user.id });
}
