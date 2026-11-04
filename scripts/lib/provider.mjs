import { mkdir, writeFile, chmod } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { resolve, delimiter } from 'node:path';
import { root } from './switch.mjs';
import { selectedProviderKey } from './provider-key.mjs';

export async function controllerEnvironment(original) {
  const env = { ...original };
  const source = resolve(homedir(), '.codex/config.toml');
  const result = spawnSync('python3', ['-c', `
import json,sys,tomllib
with open(sys.argv[1], 'rb') as f: d=tomllib.load(f)
p=d.get('model_provider')
print(json.dumps({'provider':p,'settings':d.get('model_providers',{}).get(p,{}),
 'model':d.get('model'),'effort':d.get('model_reasoning_effort')}))
`, source], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error('Could not read the existing Codex provider configuration.');
  const config = JSON.parse(result.stdout);
  const key = config.settings.env_key;
  const selected = await selectedProviderKey();
  if (selected && key) env[key] = selected;
  // Switch forwards OPENAI_API_KEY to its native session hosts, but drops
  // arbitrary provider variables. Adapt only this private controller home.
  if (!key || key === 'OPENAI_API_KEY') return env;
  if (!env[key]) throw new Error(`The configured Codex provider credential (${key}) is unavailable.`);
  env.OPENAI_API_KEY = env[key];
  const home = resolve(root, '.runtime/codex-provider');
  await mkdir(home, { recursive: true, mode: 0o700 });
  const value = input => typeof input === 'string' ? JSON.stringify(input) : String(input);
  const settings = { ...config.settings };
  if (Object.values(settings).some(v => !['string', 'boolean', 'number'].includes(typeof v))) {
    throw new Error('Unsupported provider setting; no controller configuration was replaced.');
  }
  const lines = ['sandbox_mode = "workspace-write"', `model_provider = ${value(config.provider)}`];
  if (config.model) lines.push(`model = ${value(config.model)}`);
  if (config.effort) lines.push(`model_reasoning_effort = ${value(config.effort)}`);
  lines.push('', `[model_providers.${JSON.stringify(config.provider)}]`,
    ...Object.entries(settings).map(([name, v]) => `${JSON.stringify(name)} = ${value(v)}`));
  await writeFile(resolve(home, 'config.toml'), lines.join('\n') + '\n', { mode: 0o600 });
  await writeFile(resolve(home, 'AGENTS.md'), 'Prefix shell commands with rtk. Keep work inside your assigned workspace.\n', { mode: 0o600 });
  const binary = spawnSync('which', ['codex'], { encoding: 'utf8', env: original }).stdout.trim();
  const directory = resolve(root, '.runtime/provider-bin');
  if (!binary || binary.startsWith(directory)) throw new Error('Could not locate the original Codex executable.');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  // OPENAI_API_KEY is just the controller-to-host carrier. Restore the
  // original provider variable before Codex sees it, retaining native auth.
  const shim = `#!${process.execPath}
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, appendFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { selectedProviderKey } from ${JSON.stringify(resolve(root, 'scripts/lib/provider-key.mjs'))};
const env = { ...process.env };
if (env.OPENAI_API_KEY) { env[${JSON.stringify(key)}] = env.OPENAI_API_KEY; delete env.OPENAI_API_KEY; }
const selected = await selectedProviderKey();
if (selected) env[${JSON.stringify(key)}] = selected;
const args = process.argv.slice(2);
if (args.some(arg => arg.startsWith('mcp_servers.switch.url='))) args.push('-c', 'mcp_servers.switch.enabled_tools=["list_rooms","connect_to_room","read_context","list_participants","post_message","send_targeted_message","send_attachment","download_attachment"]');
if (existsSync(${JSON.stringify(resolve(root, '.runtime/provider-diagnostic.json'))})) args.push('-c', ${JSON.stringify(`model_providers.${config.provider}.base_url="http://127.0.0.1:8093/v1"`)});
const recoveryFile = ${JSON.stringify(resolve(root, '.runtime/provider-recovery.json'))};
const recover = args.includes('app-server') && existsSync(recoveryFile) && JSON.parse(readFileSync(recoveryFile, 'utf8')).cwd === process.cwd();
const child = spawn(${JSON.stringify(binary)}, args, { env, stdio: recover ? ['pipe', 'inherit', 'inherit'] : 'inherit' });
if (recover) {
  const lines = createInterface({ input: process.stdin });
  lines.on('line', line => {
    const message = JSON.parse(line);
    if (message.method === 'thread/resume') {
      appendFileSync(${JSON.stringify(resolve(root, '.runtime/evidence/provider-recovery.jsonl'))}, JSON.stringify({ timestamp: new Date().toISOString(), previous_thread: message.params.threadId, cwd: process.cwd(), action: 'start_fresh_native_conversation' }) + '\\n', { mode: 0o600 });
      message.method = 'thread/start';
      delete message.params.threadId;
    }
    child.stdin.write(JSON.stringify(message) + '\\n');
  });
  lines.on('close', () => child.stdin.end());
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', () => { process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
`;
  await writeFile(resolve(directory, 'package.json'), '{"type":"module"}\n', { mode: 0o600 });
  await writeFile(resolve(directory, 'codex'), shim, { mode: 0o700 });
  await chmod(resolve(directory, 'codex'), 0o700);
  env.PATH = directory + delimiter + (env.PATH ?? '');
  env.CODEX_HOME = home;
  return env;
}
