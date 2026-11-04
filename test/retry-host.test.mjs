import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { mkdtemp, writeFile, rm, unlink, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { hostRequest } from '../scripts/lib/retry.mjs';
import { retrySocket } from '../scripts/lib/retry-socket.mjs';
import { root } from '../scripts/lib/switch.mjs';

test('Retry socket fits Linux sockaddr_un and refuses invalid session paths', () => {
  assert.ok(Buffer.byteLength(retrySocket(root, 'a'.repeat(64))) <= 107);
  assert.throws(() => retrySocket(root, '../other'), /Invalid retry session/);
  assert.throws(() => retrySocket('/' + 'a'.repeat(110), 'a'.repeat(64)), /too long/);
});

test('local adapter forwards native Retry and model selection with idempotent receipts', { timeout: 15000 }, async t => {
  const directory = await mkdtemp(resolve(tmpdir(), 'chainroom-retry-test-'));
  const hash = randomBytes(32).toString('hex'), socket = retrySocket(root, hash);
  const fixture = resolve(directory, 'shared-host.mjs');
  await writeFile(fixture, `
const commands = [];
const snapshot = () => ({ session: { sessionId: 'fixture-session', epoch: 'fixture-epoch',
  capabilities: { retry: true, modelChange: true }, models: [{ id: 'gpt-6-astra' }] },
  turns: [], commandStatuses: commands.map(command => ({ commandId: command.commandId, status: 'applied' })), commands });
process.on('message', message => {
  if (message.kind !== 'request') return;
  let value;
  if (message.request.type === 'snapshot') value = snapshot();
  else {
    commands.push(message.request.command);
    value = { commandId: message.request.command.commandId, status: 'applied' };
  }
  process.send({ kind: 'reply', id: message.id, ok: true, value });
});
process.send({ kind: 'ready' });
`);
  const child = fork(fixture, [`${directory}/.local/state/switch/sdk-sessions/${hash}`], {
    execArgv: ['--import', resolve(root, 'scripts/lib/retry-host.mjs')], stdio: ['ignore', 'ignore', 'pipe', 'ipc']
  });
  let errors = '';
  child.stderr.on('data', chunk => { errors += chunk; });
  t.after(async () => {
    const exited = new Promise(resolveExit => child.once('exit', resolveExit));
    if (child.exitCode === null) { child.kill(); await exited; }
    await unlink(socket).catch(() => {});
    await rm(directory, { recursive: true, force: true });
  });
  let snapshot;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { snapshot = await hostRequest(hash, '/snapshot'); break; }
    catch (error) {
      if (!['ENOENT', 'ECONNREFUSED'].includes(error.code)) throw error;
      if (child.exitCode !== null) throw new Error(errors || 'Fixture exited.');
      await delay(25);
    }
  }
  assert.ok(snapshot, errors);
  assert.equal((await stat(socket)).mode & 0o777, 0o600);
  const input = { commandId: 'fixture-retry-command', messageId: 'original-message', actorId: 'builder', model: 'gpt-6-astra' };
  await assert.rejects(hostRequest(hash, '/retry', { ...input, model: 'unavailable' }), /unavailable/);
  assert.equal((await hostRequest(hash, '/snapshot')).commands.length, 0);
  assert.equal((await hostRequest(hash, '/retry', input)).status, 'applied');
  assert.equal((await hostRequest(hash, '/retry', input)).status, 'applied');
  const recorded = (await hostRequest(hash, '/snapshot')).commands;
  assert.equal(recorded.length, 2);
  assert.deepEqual(recorded.map(command => command.body), [
    { type: 'session.model.set', modelId: 'gpt-6-astra', options: {} },
    { type: 'message.retry', messageId: 'original-message' }
  ]);
  assert.ok(recorded.every(command => command.sessionId === 'fixture-session' && command.epoch === 'fixture-epoch'));
  assert.equal(recorded[1].origin.actorId, 'builder');
});
