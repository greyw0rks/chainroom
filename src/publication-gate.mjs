const shaPattern = /^[a-f0-9]{40}$/;
const refuse = reason => ({ allowed: false, reason });

// These messages must come directly from authenticated Switch history.
// A JSON export or an actor name inside a message is never authority.
export function evaluatePublication({ incident, roomId, threadId, commitSha, messages, engineerId, sentinelId, approverIds, reviewOnly = false }) {
  if (!/^CR-\d+$/.test(incident) || !shaPattern.test(commitSha) || !roomId || !threadId ||
      !engineerId || !sentinelId || engineerId === sentinelId || !Array.isArray(approverIds) || !approverIds.length) {
    return refuse('invalid_context');
  }
  if (!Array.isArray(messages) || messages.some(message => !Number.isSafeInteger(message.seq) || message.seq < 1 || !message.messageId || typeof message.body !== 'string')) {
    return refuse('invalid_history');
  }
  if (new Set(messages.map(message => message.seq)).size !== messages.length || new Set(messages.map(message => message.messageId)).size !== messages.length) {
    return refuse('ambiguous_history');
  }
  const history = messages.filter(message => message.roomId === roomId && message.threadRootId === threadId).sort((a, b) => a.seq - b.seq);
  const fromAgent = (message, id) => message.sender?.kind === 'agent' && message.sender.agentId === id && !message.sender.userId;
  const record = (message, type) => {
    const prefix = `CHAINROOM_${type}\n`;
    if (!message.body.startsWith(prefix)) return null;
    try {
      const value = JSON.parse(message.body.slice(prefix.length));
      return value && value.incident === incident ? value : null;
    } catch { return null; }
  };
  const proposals = history.filter(message => fromAgent(message, engineerId) && record(message, 'PROPOSAL'));
  const proposalMessage = proposals.at(-1);
  if (!proposalMessage) return refuse('missing_proposal');
  const proposal = record(proposalMessage, 'PROPOSAL');
  if (proposal.commit_sha !== commitSha) return refuse('stale_commit');
  if (!shaPattern.test(proposal.base_sha) || proposal.base_sha === commitSha) return refuse('invalid_base');

  const evidenceFor = (ids, actorId, beforeSeq) => {
    if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length) return null;
    const evidence = ids.map(id => history.find(message => message.messageId === id));
    if (evidence.some(message => !message || !fromAgent(message, actorId) || message.seq >= beforeSeq)) return null;
    const records = evidence.map(message => record(message, 'TEST'));
    if (records.some(value => !value || value.commit_sha !== commitSha || value.base_sha !== proposal.base_sha || value.exit_code !== 0 ||
        typeof value.cwd !== 'string' || !value.cwd || typeof value.stdout !== 'string' || typeof value.stderr !== 'string' ||
        !Number.isFinite(Date.parse(value.timestamp)))) return null;
    if (!['npm test', 'git diff --check'].every(command => records.some(value => value.command === command))) return null;
    return { messages: evidence, records };
  };
  const engineerEvidence = evidenceFor(proposal.evidence_message_ids, engineerId, proposalMessage.seq);
  if (!engineerEvidence) return refuse('invalid_engineer_evidence');
  const reviews = history.filter(message => message.seq > proposalMessage.seq && fromAgent(message, sentinelId) && record(message, 'REVIEW'));
  const reviewMessage = reviews.at(-1);
  if (!reviewMessage) return refuse('missing_review');
  const review = record(reviewMessage, 'REVIEW');
  if (review.commit_sha !== commitSha) return refuse('stale_review');
  if (review.verdict !== 'PASS') return refuse('review_not_passed');
  const sentinelEvidence = evidenceFor(review.evidence_message_ids, sentinelId, reviewMessage.seq);
  if (!sentinelEvidence || sentinelEvidence.messages.some(message => message.seq <= proposalMessage.seq)) return refuse('invalid_sentinel_evidence');
  if (sentinelEvidence.records.some(value => engineerEvidence.records.some(engineer => engineer.cwd === value.cwd))) return refuse('shared_review_workspace');
  const evidence = { incident, commit_sha: commitSha, base_sha: proposal.base_sha,
    proposal_message_id: proposalMessage.messageId, review_message_id: reviewMessage.messageId,
    evidence_message_ids: [...proposal.evidence_message_ids, ...review.evidence_message_ids] };
  if (reviewOnly) return { allowed: false, reason: 'human_decision_required', review_ready: true, ...evidence };

  // The last authorized decision for this incident wins, including a later
  // rejection or decision for a different revision. Quoted commands fail.
  const decisions = history.filter(message => message.sender?.kind === 'human' && !message.sender.agentId && approverIds.includes(message.sender.userId))
    .map(message => ({ message, match: message.body.trim().match(/^(APPROVE|REJECT) (CR-\d+) ([a-f0-9]{40})(?: ([^\r\n]+))?$/) }))
    .filter(({ match }) => match && match[2] === incident && (match[1] === 'REJECT' || !match[4]));
  const decision = decisions.at(-1);
  if (!decision) return refuse('missing_human_decision');
  if (decision.match[3] !== commitSha) return refuse('stale_decision');
  if (decision.match[1] !== 'APPROVE') return refuse('human_rejected');
  if (decision.message.seq <= reviewMessage.seq) return refuse('decision_precedes_review');
  return {
    allowed: true, ...evidence,
    decision_message_id: decision.message.messageId, human_actor: decision.message.sender.userId,
  };
}
