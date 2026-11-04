import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { root } from './switch.mjs';

export async function selectedProviderKey() {
  let selection;
  try { selection = JSON.parse(await readFile(resolve(root, '.runtime/provider-key-source.json'), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw new Error('Could not read the private provider key selection.'); }
  const lines = (await readFile(selection.path, 'utf8')).split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#'));
  const line = lines[selection.index];
  const key = line?.match(/\bsk-[a-zA-Z0-9_-]+\b/)?.[0] ?? line;
  if (!key || !/^[\x21-\x7e]+$/.test(key)) throw new Error('The selected provider key is empty or malformed.');
  return key;
}
