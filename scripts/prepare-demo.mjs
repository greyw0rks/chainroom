import { mkdir, cp, access, writeFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const repo = resolve(root, '.runtime/demo-repo');
let initialized = false;
try { await access(resolve(repo, '.git')); initialized = true; } catch {}
if (!initialized) {
  await mkdir(repo, { recursive: true });
  if ((await readdir(repo)).length) throw new Error('Demo directory contains files but no Git repository; inspect it before preparation.');
  for (const name of await readdir(resolve(root, 'demo'))) {
    await cp(resolve(root, 'demo', name), resolve(repo, name), { recursive: true, force: false, errorOnExist: true });
  }
}
function git(args) {
  const result = spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Git ${args[0]} failed: ${result.stderr}`);
  return result.stdout.trim();
}
if (!initialized) {
  git(['init', '-b', 'main']);
  git(['config', 'user.name', 'Chainroom Demo']);
  git(['config', 'user.email', 'chainroom-demo@users.noreply.github.com']);
  git(['add', 'README.md', 'package.json', 'src/balance.ts', 'test/balance.test.ts']);
  git(['commit', '-m', 'demo: introduce controlled token-decimals regression']);
}
const sha = git(['rev-parse', 'HEAD']);
const run = spawnSync('npm', ['test'], { cwd: repo, encoding: 'utf8' });
const evidence = {
  kind: 'controlled-fixture-baseline', repository: repo, commit: sha,
  command: 'npm test', cwd: repo, exit_code: run.status,
  stdout: run.stdout, stderr: run.stderr, timestamp: new Date().toISOString()
};
await mkdir(resolve(root, '.runtime/evidence'), { recursive: true });
await writeFile(resolve(root, '.runtime/evidence/baseline.json'), JSON.stringify(evidence, null, 2)+'\n');
if (run.status !== 1 || !run.stdout.includes('# pass 4') || !run.stdout.includes('# fail 2')) {
  throw new Error('Baseline did not produce four passing and two failing tests; inspect evidence/baseline.json');
}
console.log(`Prepared independent demo Git repository ${repo}\nBase commit ${sha}\nBaseline: 4 pass, 2 fail (intentional)`);
