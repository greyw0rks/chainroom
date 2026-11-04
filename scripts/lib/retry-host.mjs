import { createServer } from 'node:http';
import { mkdir, chmod, unlink } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { retrySocket } from './retry-socket.mjs';
import { providerModels } from '../../src/provider-models.mjs';

// The signed controller remains unchanged. Its session host already serves
// Console's snapshot and message.retry commands on its parent IPC channel.
// This local adapter carries those two requests from the Chainroom dashboard
// into that same handler and returns its actual receipt.
const project = resolve(import.meta.dirname, '../..');
const sessionRoot = process.argv[2];
if (basename(process.argv[1] ?? '') === 'shared-host.mjs' &&
    sessionRoot?.includes('/.local/state/switch/sdk-sessions/') && process.send) {
  const directory = resolve(project, '.runtime/retry-hosts');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const socket = retrySocket(project, basename(sessionRoot));
  let nextId = 9000000000000;
  let starting = false;
  const pending = new Map();
  const send = process.send.bind(process);
  process.send = function (message, ...args) {
    if (message?.kind === 'ready' && !starting) {
      starting = true;
      start().catch(error => console.error(`Chainroom retry adapter unavailable: ${error.code ?? error.name}`));
    }
    const entry = message?.kind === 'reply' ? pending.get(message.id) : null;
    if (!entry) return send(message, ...args);
    pending.delete(message.id); clearTimeout(entry.timer);
    if (message.ok) entry.resolve(message.value);
    else entry.reject(new Error(message.error ?? 'Session host refused the request.'));
    const callback = args.find(arg => typeof arg === 'function');
    callback?.(null);
    return true;
  };
  const request = input => new Promise((resolveRequest, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('Session host did not confirm the request.')); }, 15000);
    pending.set(id, { resolve: resolveRequest, reject, timer });
    process.emit('message', { kind: 'request', id, request: input });
  });
  async function start() {
  await unlink(socket).catch(error => { if (error.code !== 'ENOENT') throw error; });
  const server = createServer(async (req, res) => {
    const answer = (code, value) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)); };
    try {
      if (req.method === 'GET' && req.url === '/snapshot') return answer(200, await request({ type: 'snapshot' }));
      if (req.method !== 'POST' || req.url !== '/retry') return answer(404, { error: 'Not found.' });
      let body = '';
      for await (const chunk of req) { body += chunk; if (body.length > 4096) return answer(413, { error: 'Request too large.' }); }
      const input = JSON.parse(body);
      if (!input.commandId || !input.messageId || !input.actorId) return answer(400, { error: 'Incomplete retry request.' });
      const snapshot = await request({ type: 'snapshot' });
      if (!snapshot.session.capabilities.retry) return answer(409, { error: 'This session does not support Retry.' });
      const command = (commandId, body) => ({ type: 'command', requesterName: null, command: {
        contractVersion: 1, commandId, sessionId: snapshot.session.sessionId,
        epoch: snapshot.session.epoch,
        origin: { surface: 'console', actorId: input.actorId, roomId: null, threadId: null, messageId: null },
        body
      } });
      const previous = snapshot.commandStatuses.find(entry => entry.commandId === input.commandId);
      if (previous) return answer(previous.status === 'rejected' ? 409 : 200, previous);
      if (input.model) {
        if (!providerModels.includes(input.model) || !snapshot.session.capabilities.modelChange ||
            !snapshot.session.models.some(model => model.id === input.model)) {
          return answer(409, { error: 'This model is unavailable for the current session.' });
        }
        const changed = await request(command(`${input.commandId}-model`, {
          type: 'session.model.set', modelId: input.model, options: {}
        }));
        if (!['accepted', 'applied'].includes(changed?.status)) return answer(409, { error: changed?.message ?? 'The model change was refused.' });
      }
      const result = await request(command(input.commandId, { type: 'message.retry', messageId: input.messageId }));
      if (!['accepted', 'applied', 'rejected'].includes(result?.status)) return answer(409, { error: 'The session host did not confirm Retry.' });
      answer(result.status === 'rejected' ? 409 : 200, result);
    } catch (error) { answer(503, { error: error.message }); }
  });
  await new Promise((resolveReady, reject) => { server.once('error', reject); server.listen(socket, resolveReady); });
  await chmod(socket, 0o600);
  server.unref();
  }
}
