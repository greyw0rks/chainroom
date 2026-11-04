import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { proposalSnapshot } from '../src/proposal-snapshot.mjs';

test('verifies the authenticated Engineer clone without importing its commit into the baseline', async t => {
  const directory = await mkdtemp(resolve(tmpdir(), 'chainroom-snapshot-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const baseline = resolve(directory, 'baseline'), workspace = resolve(directory, 'engineer'), repository = resolve(workspace, 'cr-001');
  await mkdir(resolve(baseline, 'src'), { recursive: true });
  const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const commit = cwd => git(cwd, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-m', 'Fixture commit');
  git(baseline, 'init', '-b', 'main');
  await writeFile(resolve(baseline, 'src/balance.ts'), 'export const decimals = 18;\n');
  git(baseline, 'add', 'src/balance.ts'); commit(baseline);
  const base = git(baseline, 'rev-parse', 'HEAD');
  await mkdir(workspace);
  git(workspace, 'clone', '--no-hardlinks', baseline, repository);
  git(repository, 'checkout', '-b', 'chainroom/cr-001');
  await writeFile(resolve(repository, 'src/balance.ts'), 'export const decimals = 6;\n');
  git(repository, 'add', 'src/balance.ts'); commit(repository);
  const sha = git(repository, 'rev-parse', 'HEAD');
  const common = { roomId: 'room', threadRootId: 'thread', sender: { kind: 'agent', agentId: 'engineer', userId: null } };
  const evidence = { incident: 'CR-001', commit_sha: sha, base_sha: base, cwd: repository };
  const messages = [
    { ...common, seq: 1, messageId: 'test', body: 'CHAINROOM_TEST\n' + JSON.stringify(evidence) },
    { ...common, seq: 2, messageId: 'proposal', body: 'CHAINROOM_PROPOSAL\n' + JSON.stringify({ incident: 'CR-001', commit_sha: sha, evidence_message_ids: ['test'] }) }
  ];
  const input = { messages, incident: 'CR-001', roomId: 'room', threadId: 'thread', engineerId: 'engineer', workspace };
  const snapshot = await proposalSnapshot(input);
  assert.deepEqual(snapshot, { repository, branch: 'refs/heads/chainroom/cr-001', commitSha: sha });
  assert.equal(git(baseline, 'rev-parse', 'HEAD'), base);
  assert.throws(() => git(baseline, 'cat-file', '-e', sha));

  await t.test('ignores a human impersonating Engineer', async () => {
    assert.equal(await proposalSnapshot({ ...input, messages: messages.map(message => ({ ...message, sender: { kind: 'human', agentId: 'engineer', userId: 'builder' } })) }), null);
  });
  await t.test('rejects evidence from another thread', async () => {
    await assert.rejects(proposalSnapshot({ ...input, messages: [{ ...messages[0], threadRootId: 'other' }, messages[1]] }), /no authenticated snapshot evidence/);
  });
  await t.test('resolves symlinks before enforcing workspace ownership', async () => {
    const link = resolve(workspace, 'escaped'); await symlink(baseline, link);
    await assert.rejects(proposalSnapshot({ ...input, messages: [{ ...messages[0], body: 'CHAINROOM_TEST\n' + JSON.stringify({ ...evidence, cwd: link }) }, messages[1]] }), /outside its assigned workspace/);
  });
  await t.test('rejects a dirty or moved proposed branch', async () => {
    await writeFile(resolve(repository, 'src/balance.ts'), 'changed\n');
    await assert.rejects(proposalSnapshot(input), /branch changed/);
    git(repository, 'checkout', '--', 'src/balance.ts');
    git(repository, 'checkout', '--detach', base);
    await assert.rejects(proposalSnapshot(input), /snapshot is unavailable|branch changed/);
  });
});
