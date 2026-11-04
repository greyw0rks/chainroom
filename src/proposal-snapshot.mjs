import { realpath } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { relative, isAbsolute } from 'node:path';

export async function proposalSnapshot({ messages, incident, roomId, threadId, engineerId, workspace }) {
  const history = messages.filter(message => message.roomId === roomId && message.threadRootId === threadId &&
    message.sender?.kind === 'agent' && message.sender.agentId === engineerId && !message.sender.userId)
    .sort((a, b) => a.seq - b.seq);
  const record = (message, type) => {
    const prefix = `CHAINROOM_${type}\n`;
    if (!message.body.startsWith(prefix)) return null;
    try { const value = JSON.parse(message.body.slice(prefix.length)); return value?.incident === incident ? value : null; }
    catch { return null; }
  };
  const proposalMessage = history.filter(message => record(message, 'PROPOSAL')).at(-1);
  if (!proposalMessage) return null;
  const proposal = record(proposalMessage, 'PROPOSAL');
  if (!/^[a-f0-9]{40}$/.test(proposal.commit_sha) || !Array.isArray(proposal.evidence_message_ids)) {
    throw new Error('The Engineer proposal is incomplete.');
  }
  const evidence = history.filter(message => proposal.evidence_message_ids.includes(message.messageId) && message.seq < proposalMessage.seq)
    .map(message => record(message, 'TEST')).find(value => value?.commit_sha === proposal.commit_sha && typeof value.cwd === 'string');
  if (!evidence) throw new Error('The Engineer proposal has no authenticated snapshot evidence.');
  const repository = await realpath(evidence.cwd), owner = await realpath(workspace);
  const within = relative(owner, repository);
  if (!within || isAbsolute(within) || within === '..' || within.startsWith('../')) {
    throw new Error('The Engineer snapshot is outside its assigned workspace.');
  }
  const git = (...args) => {
    const result = spawnSync('git', ['-C', repository, ...args], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error('The proposed Git snapshot is unavailable.');
    return result.stdout.trim();
  };
  const branch = 'refs/heads/chainroom/cr-001';
  if (git('rev-parse', '--show-toplevel') !== repository || git('symbolic-ref', 'HEAD') !== branch ||
      git('rev-parse', 'HEAD') !== proposal.commit_sha || git('status', '--porcelain')) {
    throw new Error('The Engineer branch changed after the proposal.');
  }
  return { repository, branch, commitSha: proposal.commit_sha };
}
