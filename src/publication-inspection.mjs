import { realpath } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve, relative, isAbsolute } from "node:path";
import { connect, root } from "../scripts/lib/switch.mjs";
import { evaluatePublication } from "./publication-gate.mjs";
import { loadThread } from "./switch-history.mjs";
import { proposalSnapshot } from './proposal-snapshot.mjs';

export async function inspectPublication({ incident, roomId, threadId, reviewOnly = false }) {
if (!/^CR-\d+$/.test(incident || '') || !roomId || !threadId) {
  throw new Error('Usage: node scripts/inspect-publication.mjs CR-001 <Switch room ID> <original thread ID>');
}
const baselineRepository = resolve(root, '.runtime/demo-repo');
const branch = 'refs/heads/chainroom/cr-001';
function git(cwd, ...args) {
  const result = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error('Git verification failed; the proposed branch or commit is unavailable.');
  return result.stdout.trim();
}
const { user, request } = await connect();
const { chats } = await request('/chats');
const room = chats?.find(chat => chat.roomId === roomId);
const members = room && (await request(`/chats/${encodeURIComponent(roomId)}/members`)).members;
if (!room || !members?.some(member => member.userId === user.id)) throw new Error('The authenticated approver is not a member of this room.');
const identity = name => {
  const candidates = room.agents.filter(agent => agent.name === name);
  if (candidates.length !== 1) throw new Error('The expected Chainroom agent identity is unavailable or ambiguous.');
  return candidates[0].id;
};
const engineerId = identity('chainroom-engineer');
const sentinelId = identity('chainroom-sentinel');
const { messages, headSeq } = await loadThread(request, roomId, threadId);
const snapshot = await proposalSnapshot({ messages, incident, roomId, threadId, engineerId,
  workspace: resolve(root, '.runtime/workspaces/engineer') });
if (!snapshot) return { result: { allowed: false, reason: 'missing_proposal' }, messages, room, headSeq };
const { repository, commitSha } = snapshot;
let result = evaluatePublication({ incident, roomId, threadId, commitSha, messages, engineerId, sentinelId, approverIds: [user.id], reviewOnly });
if (result.allowed || result.review_ready) {
  if (git(baselineRepository, 'rev-parse', 'HEAD') !== result.base_sha || git(baselineRepository, 'status', '--porcelain')) {
    return { result: { allowed: false, reason: 'changed_baseline' }, repository, branch, commitSha, messages, room, headSeq };
  }
  git(repository, 'merge-base', '--is-ancestor', result.base_sha, commitSha);
  const changes = git(repository, 'diff', '--name-status', result.base_sha, commitSha).split('\n');
  if (!changes.length || changes.some(change => !/^[AM]\tsrc\/[a-zA-Z0-9_./-]+$/.test(change))) {
    result = { allowed: false, reason: 'patch_outside_source_scope' };
  } else {
    if (git(repository, 'status', '--porcelain') || git(repository, 'rev-parse', 'HEAD') !== commitSha || git(repository, 'rev-parse', branch) !== commitSha) {
      result = { allowed: false, reason: 'changed_patch' };
    }
  }
  if (result.allowed || result.review_ready) {
    // A distinct string is insufficient: resolve symlinks and verify each
    // evidence directory is the role's own clean snapshot of this commit.
    const snapshots = { engineer: new Set(), sentinel: new Set() };
    for (const id of result.evidence_message_ids) {
      const message = messages.find(message => message.messageId === id);
      const evidence = JSON.parse(message.body.slice('CHAINROOM_TEST\n'.length));
      const role = message.sender.agentId === engineerId ? 'engineer' : 'sentinel';
      const workspace = await realpath(resolve(root, '.runtime/workspaces', role));
      const cwd = await realpath(evidence.cwd);
      snapshots[role].add(cwd);
      const within = relative(workspace, cwd);
      if (isAbsolute(within) || within === '..' || within.startsWith('../') || git(cwd, 'rev-parse', '--show-toplevel') !== cwd ||
          git(cwd, 'rev-parse', 'HEAD') !== commitSha || git(cwd, 'status', '--porcelain')) {
        result = { allowed: false, reason: 'invalid_review_snapshot' };
        break;
      }
    }
    if ((result.allowed || result.review_ready) && [...snapshots.engineer].some(cwd => snapshots.sentinel.has(cwd))) {
      result = { allowed: false, reason: 'shared_review_workspace' };
    }
  }
}
return { result, repository, branch, commitSha, messages, room, headSeq };
}
