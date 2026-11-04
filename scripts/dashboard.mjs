import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { connect, root } from './lib/switch.mjs';
import { inspectPublication } from '../src/publication-inspection.mjs';
import { workflowRetries, retryWorkflow } from './lib/retry.mjs';
import { providerModels } from '../src/provider-models.mjs';

const port = 3018, origin = `http://127.0.0.1:${port}`;
const session = randomBytes(32).toString('hex'), csrf = randomBytes(32).toString('hex');
const staticFiles = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
async function state() {
  const provision = JSON.parse(await readFile(resolve(root, '.runtime/provisioned.json'), 'utf8'));
  const { user, request } = await connect();
  const roomId = provision.room.room_id;
  const page = await request(`/chats/${roomId}/messages?limit=200`);
  const report = page.messages.find(m => m.sender.kind === 'human' && /Controlled demo regression/.test(m.body));
  const threadId = report?.threadRootId ?? report?.messageId;
  let gate = { allowed: false, reason: report ? 'waiting_for_proposal' : 'waiting_for_report' }, review, repository;
  if (threadId) {
    try {
      gate = (await inspectPublication({ incident: 'CR-001', roomId, threadId })).result;
      const inspected = await inspectPublication({ incident: 'CR-001', roomId, threadId, reviewOnly: true });
      review = inspected.result; repository = inspected.repository;
    } catch { gate = { allowed: false, reason: 'waiting_for_proposed_commit' }; }
  }
  let diff = '';
  if (review?.review_ready) {
    const r = spawnSync('git', ['-C', repository, 'diff', review.base_sha, review.commit_sha], { encoding: 'utf8' });
    if (r.status === 0) diff = r.stdout;
  }
  return { checked_at: new Date().toISOString(), room_id: roomId, thread_id: threadId,
    viewer: user.name, report, messages: page.messages, gate, review, diff, has_more: page.hasMore,
    retries: await workflowRetries({ provision, roomId, threadId }), provider_models: providerModels };
}
const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
const server = createServer(async (req, res) => {
  try {
    if (req.headers.host !== `127.0.0.1:${port}`) return json(res, 403, { error: `Open ${origin}` });
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'");
    if (req.method === 'GET' && staticFiles[req.url]) {
      const [file, type] = staticFiles[req.url];
      if (req.url === '/') res.setHeader('set-cookie', `chainroom_session=${session}; HttpOnly; SameSite=Strict; Path=/`);
      res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
      return res.end(await readFile(resolve(root, 'web', file)));
    }
    const authenticated = req.headers.cookie?.split(';').some(c => c.trim() === `chainroom_session=${session}`);
    if (!authenticated) return json(res, 401, { error: 'Open the dashboard to establish a local session.' });
    if (req.method === 'GET' && req.url === '/api/state') return json(res, 200, { ...await state(), csrf });
    if (req.method === 'POST' && req.url === '/api/retry') {
      if (req.headers.origin !== origin || req.headers['x-chainroom-csrf'] !== csrf) return json(res, 403, { error: 'Invalid dashboard session.' });
      let text = '';
      for await (const chunk of req) { text += chunk; if (text.length > 4096) return json(res, 413, { error: 'Retry is too large.' }); }
      const body = JSON.parse(text), current = await state();
      if (current.thread_id !== body.thread) return json(res, 409, { error: 'The incident thread changed. Refresh before retrying.' });
      const provision = JSON.parse(await readFile(resolve(root, '.runtime/provisioned.json'), 'utf8'));
      const { user, request } = await connect();
      try {
        const receipt = await retryWorkflow({ provision, roomId: current.room_id, threadId: current.thread_id,
          role: body.role, messageId: body.message_id, requestId: body.request_id, model: body.model, user, request });
        return json(res, receipt.status === 'rejected' ? 409 : 200, { receipt });
      } catch (error) { return json(res, 409, { error: error.message }); }
    }
    if (req.method === 'POST' && req.url === '/api/decision') {
      if (req.headers.origin !== origin || req.headers['x-chainroom-csrf'] !== csrf) return json(res, 403, { error: 'Invalid dashboard session.' });
      let text = '';
      for await (const chunk of req) { text += chunk; if (text.length > 4096) return json(res, 413, { error: 'Decision is too large.' }); }
      const body = JSON.parse(text);
      if (!['APPROVE', 'REJECT'].includes(body.decision) || !/^[a-f0-9]{40}$/.test(body.sha ?? '') || !body.thread) return json(res, 400, { error: 'Invalid decision.' });
      if (body.decision === 'REJECT' && !/^[^\r\n]{1,300}$/.test(body.reason ?? '')) return json(res, 400, { error: 'A one-line rejection reason is required.' });
      const current = await state();
      if (!current.review?.review_ready || current.review.commit_sha !== body.sha || current.thread_id !== body.thread) return json(res, 409, { error: 'The reviewed commit changed or verification is incomplete. Refresh before deciding.' });
      const { request } = await connect();
      const sent = await request(`/chats/${current.room_id}/messages`, { requestId: randomUUID(),
        body: `${body.decision} CR-001 ${body.sha}${body.decision === 'REJECT' ? ' ' + body.reason : ''}`,
        threadRootId: body.thread, uploadIds: [] });
      return json(res, 200, { recorded: true, message_ids: sent.messages.map(m => m.messageId) });
    }
    json(res, 404, { error: 'Not found.' });
  } catch (error) { json(res, 503, { error: error.message.startsWith('Switch ') ? error.message : 'The live workflow is unavailable. Check Switch and the controller.' }); }
});
server.listen(port, '127.0.0.1', () => console.log(`Chainroom evidence view: ${origin}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
