import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePublication } from '../src/publication-gate.mjs';

const sha = 'a'.repeat(40), base = 'b'.repeat(40), otherSha = 'c'.repeat(40);
const engineer = { kind: 'agent', agentId: 'engineer', userId: null };
const sentinel = { kind: 'agent', agentId: 'sentinel', userId: null };
const human = { kind: 'human', agentId: null, userId: 'builder' };
const message = (seq, sender, body) => ({ messageId: `message-${seq}`, seq, sender: { ...sender }, body, roomId: 'room', threadRootId: 'thread' });
const record = (type, fields) => `CHAINROOM_${type}\n${JSON.stringify({ incident: 'CR-001', commit_sha: sha, base_sha: base, ...fields })}`;
function context() {
  const evidence = (seq, sender, command, cwd) => message(seq, sender, record('TEST', {
    command, cwd, exit_code: 0, stdout: command === 'npm test' ? '6 passed; 0 failed' : '', stderr: '', timestamp: '2026-11-04T10:00:00Z',
  }));
  return {
    incident: 'CR-001', roomId: 'room', threadId: 'thread', commitSha: sha,
    engineerId: 'engineer', sentinelId: 'sentinel', approverIds: ['builder'],
    messages: [
      evidence(1, engineer, 'npm test', '/engineer/worktree'),
      evidence(2, engineer, 'git diff --check', '/engineer/worktree'),
      message(3, engineer, record('PROPOSAL', { evidence_message_ids: ['message-1', 'message-2'] })),
      evidence(4, sentinel, 'npm test', '/sentinel/snapshot'),
      evidence(5, sentinel, 'git diff --check', '/sentinel/snapshot'),
      message(6, sentinel, record('REVIEW', { verdict: 'PASS', evidence_message_ids: ['message-4', 'message-5'] })),
      message(7, human, `APPROVE CR-001 ${sha}`),
    ],
  };
}
function mutateRecord(message, changes) {
  const [prefix, body] = message.body.split('\n');
  message.body = `${prefix}\n${JSON.stringify({ ...JSON.parse(body), ...changes })}`;
}
test('permits an exact commit after separate tests, Sentinel review and human decision', () => {
  const result = evaluatePublication(context());
  assert.equal(result.allowed, true);
  assert.equal(result.decision_message_id, 'message-7');
  assert.equal(result.human_actor, 'builder');
});
const refusals = [
  ['agent approval', c => { c.messages[6].sender = engineer; }, 'missing_human_decision'],
  ['agent disguised as a human', c => { c.messages[6].sender.agentId = 'engineer'; }, 'missing_human_decision'],
  ['unauthorized human', c => { c.messages[6].sender = { ...human, userId: 'stranger' }; }, 'missing_human_decision'],
  ['quoted approval', c => { c.messages[6].body = `> APPROVE CR-001 ${sha}`; }, 'missing_human_decision'],
  ['approval for another incident', c => { c.messages[6].body = `APPROVE CR-002 ${sha}`; }, 'missing_human_decision'],
  ['later rejection', c => { c.messages.push(message(8, human, `REJECT CR-001 ${sha} needs another check`)); }, 'human_rejected'],
  ['approval before review', c => { c.messages[6].seq = 6; c.messages[5].seq = 7; }, 'decision_precedes_review'],
  ['approval before later review', c => { c.messages.push(message(8, sentinel, c.messages[5].body)); }, 'decision_precedes_review'],
  ['stale approval', c => { c.messages[6].body = `APPROVE CR-001 ${otherSha}`; }, 'stale_decision'],
  ['changed branch commit', c => { c.commitSha = otherSha; }, 'stale_commit'],
  ['new proposal invalidates old review', c => { c.messages.push(message(8, engineer, c.messages[2].body)); }, 'missing_review'],
  ['no review', c => { c.messages.splice(5, 1); }, 'missing_review'],
  ['wrong reviewer', c => { c.messages[5].sender = engineer; }, 'missing_review'],
  ['failed review', c => { mutateRecord(c.messages[5], { verdict: 'FAIL' }); }, 'review_not_passed'],
  ['later blocked review', c => { c.messages.push(message(8, sentinel, record('REVIEW', { verdict: 'BLOCKED' }))); }, 'review_not_passed'],
  ['stale review', c => { mutateRecord(c.messages[5], { commit_sha: otherSha }); }, 'stale_review'],
  ['Engineer test failure', c => { mutateRecord(c.messages[0], { exit_code: 1 }); }, 'invalid_engineer_evidence'],
  ['Sentinel test failure', c => { mutateRecord(c.messages[3], { exit_code: 1 }); }, 'invalid_sentinel_evidence'],
  ['missing independent test', c => { mutateRecord(c.messages[5], { evidence_message_ids: ['message-5'] }); }, 'invalid_sentinel_evidence'],
  ['review reuses Engineer evidence', c => { mutateRecord(c.messages[5], { evidence_message_ids: ['message-1', 'message-2'] }); }, 'invalid_sentinel_evidence'],
  ['review in Engineer worktree', c => { mutateRecord(c.messages[3], { cwd: '/engineer/worktree' }); }, 'shared_review_workspace'],
  ['cross-thread evidence', c => { c.messages[3].threadRootId = 'unrelated'; }, 'invalid_sentinel_evidence'],
  ['cross-room decision', c => { c.messages[6].roomId = 'unrelated'; }, 'missing_human_decision'],
  ['missing transcript', c => { mutateRecord(c.messages[3], { stdout: null }); }, 'invalid_sentinel_evidence'],
  ['unrelated evidence commit', c => { mutateRecord(c.messages[3], { commit_sha: otherSha }); }, 'invalid_sentinel_evidence'],
  ['duplicate history', c => { c.messages.push(c.messages[0]); }, 'ambiguous_history'],
];
for (const [name, mutate, reason] of refusals) test(`rejects ${name}`, () => {
  const c = context(); mutate(c);
  assert.deepEqual(evaluatePublication(c), { allowed: false, reason });
});
test('history is evaluated by Switch sequence, regardless of pagination order', () => {
  const c = context(); c.messages.reverse();
  assert.equal(evaluatePublication(c).allowed, true);
});
test('review-only inspection cannot authorize publication', () => {
  const c = context(); c.messages.pop();
  const result = evaluatePublication({ ...c, reviewOnly: true });
  assert.equal(result.allowed, false);
  assert.equal(result.review_ready, true);
  assert.equal(result.human_actor, undefined);
});
