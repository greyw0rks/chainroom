import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

// Readiness inspection only: no model turn, task, sign-in or config mutation.
const child = spawn('codex', ['app-server'], { stdio: ['pipe', 'pipe', 'pipe'] });
const lines = createInterface({ input: child.stdout });
let completed = false;
const send = message => child.stdin.write(JSON.stringify(message)+'\n');
const timer = setTimeout(() => {
  console.error('Codex readiness inspection timed out.');
  child.kill();
  process.exitCode = 1;
}, 15000);
child.on('error', () => { clearTimeout(timer); process.exitCode = 1; });
child.on('exit', () => { clearTimeout(timer); if (!completed) process.exitCode = 1; });
lines.on('line', line => {
  let message;
  try { message = JSON.parse(line); } catch { return; }
  if (message.id === 1 && message.result) {
    send({ jsonrpc: '2.0', method: 'initialized' });
    send({ jsonrpc: '2.0', id: 2, method: 'account/read', params: { refreshToken: false } });
  }
  if (message.id === 2) {
    completed = true;
    const result = message.result;
    if (result) {
      console.log(JSON.stringify({ accountType: result.account?.type ?? null, requiresOpenaiAuth: result.requiresOpenaiAuth }));
    } else {
      console.error('Codex refused the account/read inspection.');
      process.exitCode = 1;
    }
    clearTimeout(timer);
    lines.close();
    child.kill();
  }
});
send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { clientInfo: { name: 'chainroom-readiness-probe', version: '0.1.0' } } });
