import { spawnSync } from 'node:child_process';

const urls = [
  'http://127.0.0.1:8066/api/v4/system/ping',
  'http://localhost:8066/api/v4/system/ping',
  'http://127.0.0.1:8082/',
];
const code = `
$ErrorActionPreference = 'Stop'
$failed = $false
foreach ($url in @(${urls.map(url => `'${url}'`).join(',')})) {
  try {
    $r = Invoke-WebRequest -Uri $url -TimeoutSec 5 -UseBasicParsing
    Write-Output "$url $($r.StatusCode)"
  } catch { Write-Output "$url unreachable"; $failed = $true }
}
if ($failed) { exit 1 }
`;
const result = spawnSync('/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',
  ['-NoProfile', '-NonInteractive', '-Command', code], { stdio: 'inherit', timeout: 30000 });
process.exitCode = result.status ?? 1;
