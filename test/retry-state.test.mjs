import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retryState } from '../src/retry-state.mjs';
const session = { body: { type: 'session.upsert', session: { sessionId: 'session', capabilities: { retry: true } } } };
const input = (id, thread = 'report') => ({ body: { type: 'item.upsert', item: { itemId: `user-${id}`, turnId: id,
  kind: 'user-message', origin: { roomId: 'room', threadId: thread, messageId: `message-${id}` } } } });
const turn = (id, status) => ({ body: { type: 'turn.upsert', turnId: id, status } });
const state = events => retryState([session, ...events], { roomId: 'room', threadId: 'report' });
test('offers the latest failed turn in the incident thread', () => {
  assert.equal(state([input('a'), turn('a', 'error')]).retryable, true);
  assert.equal(state([input('a'), turn('a', 'interrupted')]).message_id, 'message-a');
});
test('does not offer an old failure after a later completed turn', () => {
  assert.equal(state([input('a'), turn('a', 'error'), input('b'), turn('b', 'completed')]).retryable, false);
});
test('blocks retry while a turn is running or queued', () => {
  for (const status of ['running', 'queued']) assert.equal(state([input('a'), turn('a', 'error'), turn('other', status)]).retryable, false);
});
test('ignores failures from another incident thread', () => {
  assert.equal(state([input('a', 'other'), turn('a', 'error')]).retryable, false);
});
test('latest recorded status wins when a retried turn completes', () => {
  assert.equal(state([input('a'), turn('a', 'error'), turn('a', 'running'), turn('a', 'completed')]).retryable, false);
});
test('does not infer native retry support', () => {
  const events = [input('a'), turn('a', 'error')];
  assert.equal(retryState(events, { roomId: 'room', threadId: 'report' }).retryable, false);
});
