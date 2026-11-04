export async function loadThread(request, roomId, threadId) {
  // The thread endpoint is gated to group chats in Switch 0.31. Mattermost
  // channel rooms use the normal paginated history endpoint. Read the whole
  // room before filtering so an older rejection cannot disappear off-page.
  const path = `/chats/${encodeURIComponent(roomId)}/messages`;
  const readPage = async query => {
    const page = await request(`${path}?${query}`);
    if (!page || !Array.isArray(page.messages) || !Number.isSafeInteger(page.headSeq) || typeof page.hasMore !== 'boolean' ||
        page.messages.some(message => !Number.isSafeInteger(message.seq) || message.seq < 1 || message.roomId !== roomId)) {
      throw new Error('Switch returned an unsupported or invalid message page.');
    }
    return page;
  };
  // Refuse a changing history instead of missing a rejection arriving during
  // pagination. The actual publisher must do this again immediately before use.
  for (let attempt = 0; attempt < 3; attempt++) {
    let page = await readPage('limit=200');
    const headSeq = page.headSeq;
    const messages = [];
    let before = Infinity;
    while (true) {
      if (messages.length + page.messages.length > 10000) throw new Error('Room history exceeds the inspection limit; no decision was made.');
      if (page.messages.some(message => message.seq >= before)) throw new Error('Switch pagination did not advance.');
      messages.push(...page.messages);
      if (!page.hasMore) break;
      if (!page.messages.length) throw new Error('Switch history was truncated.');
      before = Math.min(...page.messages.map(message => message.seq));
      page = await readPage(`limit=200&beforeSeq=${before}`);
    }
    const latest = await readPage('limit=1');
    if (latest.headSeq === headSeq) return { headSeq,
      messages: messages.filter(message => message.threadRootId === threadId || message.messageId === threadId) };
  }
  throw new Error('Switch history changed during inspection; retry when the thread is stable.');
}
