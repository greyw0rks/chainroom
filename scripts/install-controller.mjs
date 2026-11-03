import { mkdir, writeFile } from 'node:fs/promises';
import { createHash, createPublicKey, verify } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const version = '0.31.1-dev.277.g2d72c57';
const name = `switch-agent-controller-${version}.tgz`;
const url = `https://github.com/sandbox-quantum/switch/releases/download/switch-agent-controller-v${version}/${name}`;
const get = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Controller download failed (${response.status})`);
  return Buffer.from(await response.arrayBuffer());
};
const [pkg, signatureText] = await Promise.all([get(url), get(url+'.sig')]);
const sha256 = createHash('sha256').update(pkg).digest('hex');
const signature = signatureText.toString().trim();
if (!/^[A-Za-z0-9+/]+={0,2}$/.test(signature)) throw new Error('Invalid release signature');
const key = createPublicKey({
  key: Buffer.from('MCowBQYDK2VwAyEAaRFfp1Yd/b91KkZs8Vj/OQSdsZS2ifd+rZu24pKTMpU=', 'base64'),
  format: 'der', type: 'spki'
});
const message = Buffer.from(`switch-agent-controller-release-v1\n${version}\n${sha256}\n`);
if (!verify(null, message, key, Buffer.from(signature, 'base64'))) throw new Error('Release signature did not verify');
const prefix = resolve(root, '.tools/controller');
await mkdir(prefix, { recursive: true });
const path = resolve(root, '.tools', name);
await writeFile(path, pkg);
console.log(`Verified release-2026-10 signature: ${version}, SHA-256 ${sha256}`);
const result = spawnSync('npm', ['install', '--global', '--ignore-scripts', '--prefix', prefix, path], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`Installed ${prefix}/bin/switch-agent-controller`);
