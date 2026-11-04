export function retryState(events, { roomId, threadId }) {
  const turns = new Map(), items = new Map();
  let session;
  for (const event of events) {
    const body = event.body;
    if (body.type === 'session.upsert') session = body.session;
    if (body.type === 'turn.upsert') turns.set(body.turnId, { ...turns.get(body.turnId), ...body });
    if (body.type === 'item.upsert') items.set(body.item.itemId, body.item);
  }
  const inputs = [...items.values()].filter(item => item.kind === 'user-message' && item.origin?.roomId === roomId &&
    (item.origin.threadId === threadId || item.origin.messageId === threadId));
  const input = inputs.at(-1), turn = input && turns.get(input.turnId);
  const busy = [...turns.values()].some(turn => ['running', 'queued'].includes(turn.status));
  return { session_id: session?.sessionId, supported: session?.capabilities.retry === true,
    model: session?.model?.id,
    status: turn?.status ?? 'waiting', busy,
    retryable: !busy && session?.capabilities.retry === true && ['error', 'interrupted'].includes(turn?.status),
    message_id: input?.origin.messageId, turn_id: input?.turnId };
}
