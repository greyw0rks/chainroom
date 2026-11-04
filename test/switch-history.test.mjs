import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadThread } from '../src/switch-history.mjs';
const m = seq => ({ seq, messageId: `m-${seq}`, roomId: 'room', threadRootId: 'thread' });
const page = (seqs, hasMore = false, headSeq = 9) => ({ messages: seqs.map(m), hasMore, headSeq });
test('reads every page before accepting history', async () => {
  const responses = [page([9, 8], true), page([7, 6]), page([9])];
  const paths = [];
  const result = await loadThread(async path => { paths.push(path); return responses.shift(); }, 'room', 'thread');
  assert.deepEqual(result.messages.map(message => message.seq), [9, 8, 7, 6]);
  assert.match(paths[1], /beforeSeq=8$/);
});
test('restarts when a new decision arrives during pagination', async () => {
  const responses = [page([9]), page([10], false, 10), page([10, 9], false, 10), page([10], false, 10)];
  const result = await loadThread(async () => responses.shift(), 'room', 'thread');
  assert.equal(result.headSeq, 10);
  assert.equal(result.messages[0].seq, 10);
});
test('refuses history that keeps changing', async () => {
  let head = 0;
  await assert.rejects(loadThread(async () => page([], false, ++head), 'room', 'thread'), /changed during inspection/);
});
test('refuses silently truncated history', async () => {
  await assert.rejects(loadThread(async () => page([], true), 'room', 'thread'), /truncated/);
});
test('refuses overlapping pagination', async () => {
  await assert.rejects(loadThread(async () => page([9], true), 'room', 'thread'), /did not advance/);
});
test('refuses an unexpected server schema', async () => {
  await assert.rejects(loadThread(async () => ({ messages: [], has_more: false, head_seq: 1 }), 'room', 'thread'), /unsupported/);
});
test('uses channel history and scans unrelated threads before filtering', async () => {
  const unrelated = { ...m(9), threadRootId: 'other' };
  const responses = [{ messages: [unrelated], hasMore: true, headSeq: 9 }, page([8, 7]), page([9])];
  const paths = [];
  const result = await loadThread(async path => { paths.push(path); return responses.shift(); }, 'room', 'thread');
  assert.deepEqual(result.messages.map(message => message.seq), [8, 7]);
  assert.equal(paths[0], '/chats/room/messages?limit=200');
});
test('rejects a page from another room', async () => {
  await assert.rejects(loadThread(async () => ({ ...page([9]), messages: [{ ...m(9), roomId: 'other' }] }), 'room', 'thread'), /invalid message page/);
});
