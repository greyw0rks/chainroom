import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publishReviewedPatch } from '../src/publication.mjs';
const proof = { allowed: true, incident: 'CR-001', commit_sha: 'a'.repeat(40), base_sha: 'b'.repeat(40),
  decision_message_id: 'decision', review_message_id: 'review', human_actor: 'builder' };
function fixture() {
  const events = [];
  return { events, options: { inspect: async () => { events.push('inspect'); return { ...proof }; },
    remoteHead: async () => null, existingPr: async () => null,
    push: async sha => events.push(['push', sha]), createPr: async p => { events.push('create'); return { url: 'https://github.com/example/demo/pull/1', head_sha: p.commit_sha }; } } };
}
test('rechecks live approval at each publication boundary and pushes the exact commit', async () => {
  const f = fixture(); const result = await publishReviewedPatch(f.options);
  assert.deepEqual(f.events, ['inspect', 'inspect', ['push', proof.commit_sha], 'inspect', 'create']);
  assert.equal(result.reused, false);
});
test('does not push or create without a human decision', async () => {
  const f = fixture(); f.options.inspect = async () => ({ allowed: false, reason: 'missing_human_decision' });
  await assert.rejects(publishReviewedPatch(f.options), /missing_human_decision/);
  assert.deepEqual(f.events, []);
});
test('a rejection arriving before push stops publication', async () => {
  const f = fixture(); let n = 0;
  f.options.inspect = async () => ++n === 1 ? proof : { allowed: false, reason: 'human_rejected' };
  await assert.rejects(publishReviewedPatch(f.options), /human_rejected/);
  assert.deepEqual(f.events, []);
});
test('a changed decision stops publication even when the SHA is unchanged', async () => {
  const f = fixture(); let n = 0;
  f.options.inspect = async () => ({ ...proof, decision_message_id: ++n === 1 ? 'decision' : 'new-decision' });
  await assert.rejects(publishReviewedPatch(f.options), /approval changed/);
  assert.deepEqual(f.events, []);
});
test('a rejection after push prevents PR creation', async () => {
  const f = fixture(); let n = 0;
  f.options.inspect = async () => ++n < 3 ? proof : { allowed: false, reason: 'human_rejected' };
  await assert.rejects(publishReviewedPatch(f.options), /human_rejected/);
  assert.deepEqual(f.events, [['push', proof.commit_sha]]);
});
test('reuses the matching existing PR after a fresh approval check', async () => {
  const f = fixture(); f.options.existingPr = async () => ({ url: 'https://github.com/example/demo/pull/1', head_sha: proof.commit_sha,
    incident: proof.incident, base_sha: proof.base_sha });
  assert.equal((await publishReviewedPatch(f.options)).reused, true);
  assert.deepEqual(f.events, ['inspect', 'inspect']);
});
test('refuses an existing PR for another revision', async () => {
  const f = fixture(); f.options.existingPr = async () => ({ head_sha: 'c'.repeat(40) });
  await assert.rejects(publishReviewedPatch(f.options), /does not match/);
});
test('never overwrites a remote branch with another SHA', async () => {
  const f = fixture(); f.options.remoteHead = async () => 'c'.repeat(40);
  await assert.rejects(publishReviewedPatch(f.options), /another commit/);
  assert.deepEqual(f.events, ['inspect']);
});
test('an already pushed exact commit skips push', async () => {
  const f = fixture(); f.options.remoteHead = async () => proof.commit_sha;
  await publishReviewedPatch(f.options);
  assert.deepEqual(f.events, ['inspect', 'inspect', 'inspect', 'create']);
});
