import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { controllerEnvironment } from './lib/provider.mjs';
import { root } from './lib/switch.mjs';
import { readFile } from 'node:fs/promises';
const env = process.argv.includes('--original') ? { ...process.env } : await controllerEnvironment(process.env);
if (process.argv.includes('--alias')) env.OPENAI_API_KEY = env.CODEX_GATEWAY_API_KEY;
const sessionHome = process.argv.indexOf('--home');
if (sessionHome >= 0) env.CODEX_HOME = process.argv[sessionHome + 1];
const contextIndex = process.argv.indexOf('--context');
const developerInstructions = contextIndex >= 0 ? JSON.parse(await readFile(process.argv[contextIndex + 1], 'utf8')).execution.context : undefined;
const child = spawn('codex', ['app-server'], { env, stdio: ['pipe', 'pipe', 'pipe'] });
let completed = false, diagnostics = '';
child.stderr.on('data', chunk => { diagnostics = (diagnostics + chunk).slice(-2000); });
const lines = createInterface({ input: child.stdout });
const send = value => child.stdin.write(JSON.stringify(value) + '\n');
const timer = setTimeout(() => { child.kill(); process.exitCode = 1; console.log('Provider probe timed out.'); }, 45000);
child.on('exit', code => {
  clearTimeout(timer);
  if (!completed) {
    process.exitCode = 1;
    const redacted = diagnostics.replace(/sk-[a-zA-Z0-9_-]+/g, '[redacted]');
    console.log(JSON.stringify({ status: 'startup_failed', exit_code: code, diagnostics: redacted }));
  }
});
child.on('error', () => { clearTimeout(timer); process.exitCode = 1; });
lines.on('line', line => {
  let m; try { m = JSON.parse(line); } catch { return; }
  if (m.id === 1) {
    send({ method: 'initialized' });
    send({ id: 2, method: 'thread/start', params: { cwd: resolve(root, '.runtime/workspaces/triage'), model: 'gpt-6.1-sol', approvalPolicy: 'never', sandbox: 'read-only', developerInstructions } });
  }
  if (m.id === 2 && m.result) send({ id: 3, method: 'turn/start', params: { threadId: m.result.thread.id,
    input: [{ type: 'text', text: 'Reply with the word ready. Do not call tools.' }] } });
  if (m.method === 'item/completed' && m.params.item.type === 'agentMessage') console.log(m.params.item.text);
  if (m.method === 'turn/completed') {
    completed = true;
    console.log(JSON.stringify({ status: m.params.turn.status, error: m.params.turn.error?.message }));
    clearTimeout(timer); lines.close(); child.kill();
    if (m.params.turn.status !== 'completed') process.exitCode = 1;
  }
  if (m.error) { console.log('Native provider probe failed.'); clearTimeout(timer); child.kill(); process.exitCode = 1; }
});
send({ id: 1, method: 'initialize', params: {
  clientInfo: process.argv.includes('--native-client') ? { name: 'switch_console', title: 'Switch Console', version: '0.31.1' } : { name: 'chainroom-provider-probe', version: '0.1.0' },
  ...(process.argv.includes('--native-client') ? { capabilities: { experimentalApi: true, requestAttestation: false } } : {})
} });
