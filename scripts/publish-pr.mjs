import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { root } from './lib/switch.mjs';
import { inspectPublication } from '../src/publication-inspection.mjs';
import { publishReviewedPatch } from '../src/publication.mjs';

const [incident, roomId, threadId, target] = process.argv.slice(2);
if (incident !== 'CR-001' || !roomId || !threadId || !/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.test(target ?? '') || process.argv.length !== 6) {
  throw new Error('Usage: publish-pr.mjs CR-001 <Switch room ID> <thread ID> <owner/demo-repository>');
}
const branch = 'chainroom/cr-001';
let repository;
const remote = `https://github.com/${target}.git`;
function command(binary, args) {
  const r = spawnSync(binary, args, { encoding: 'utf8', cwd: repository, timeout: 120000 });
  if (r.status !== 0) throw new Error(`${binary} failed; publication did not complete. Inspect repository access and branch state.`);
  return r.stdout.trim();
}
const ghJson = args => JSON.parse(command('gh', args));
let initial;
const inspect = async () => {
  const inspected = await inspectPublication({ incident, roomId, threadId });
  if (inspected.result.allowed) repository = inspected.repository;
  if (!initial && inspected.result.allowed) {
    initial = inspected.result;
    const repo = ghJson(['api', `repos/${target}`]);
    initial.default_branch = repo.default_branch;
  }
  return inspected.result;
};
const existingPr = async () => {
  const prs = ghJson(['pr', 'list', '--repo', target, '--head', branch, '--state', 'all', '--json', 'url,headRefOid,body']);
  if (prs.length > 1) throw new Error('Publication refused: more than one pull request uses the incident branch.');
  if (!prs.length) return null;
  const marker = prs[0].body.match(/<!-- chainroom:(CR-\d+):([a-f0-9]{40}):([a-f0-9]{40}) -->/);
  return { url: prs[0].url, head_sha: marker?.[3] === prs[0].headRefOid ? prs[0].headRefOid : null, incident: marker?.[1], base_sha: marker?.[2] };
};
const verifyBase = () => {
  const base = ghJson(['api', `repos/${target}/commits/${initial.default_branch}`]);
  if (base.sha !== initial.base_sha) throw new Error('Publication refused: target default branch differs from the reviewed baseline.');
};
const result = await publishReviewedPatch({ inspect, existingPr,
  remoteHead: async () => {
    verifyBase();
    const lines = command('git', ['ls-remote', '--heads', remote, `refs/heads/${branch}`]);
    return lines ? lines.split(/\s+/)[0] : null;
  },
  push: async sha => command('git', ['push', remote, `${sha}:refs/heads/${branch}`]),
  createPr: async proof => {
    verifyBase();
    const directory = await mkdtemp(join(tmpdir(), 'chainroom-pr-'));
    const bodyFile = join(directory, 'body.md');
    await writeFile(bodyFile, `The controlled USDC regression displays 75000000 atomic units as 0.000000000075 instead of 75. This patch fixes token-decimal formatting using exact integer arithmetic.\n\nEngineer and Sentinel independently ran npm test and git diff --check on ${proof.commit_sha}. The human decision is bound to that commit.\n\nSwitch room: ${roomId}\nThread: ${threadId}\nReview: ${proof.review_message_id}\nHuman decision: ${proof.decision_message_id}\n\n<!-- chainroom:${incident}:${proof.base_sha}:${proof.commit_sha} -->\n`);
    const url = command('gh', ['pr', 'create', '--repo', target, '--base', initial.default_branch,
      '--head', branch, '--title', 'Fix USDC balance formatting in the controlled regression', '--body-file', bodyFile]);
    return { url, head_sha: proof.commit_sha, incident, base_sha: proof.base_sha };
  }
});
await mkdir(resolve(root, '.runtime/evidence'), { recursive: true, mode: 0o700 });
await writeFile(resolve(root, '.runtime/evidence/publication.json'), JSON.stringify({ published_at: new Date().toISOString(), ...result }, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify(result, null, 2));
