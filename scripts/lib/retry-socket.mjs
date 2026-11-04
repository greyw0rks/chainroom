import { resolve } from 'node:path';

export function retrySocket(project, hash) {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('Invalid retry session.');
  const socket = resolve(project, '.runtime/retry-hosts', `${hash.slice(0, 32)}.sock`);
  // sockaddr_un includes the terminating NUL in its 108-byte Linux limit.
  if (Buffer.byteLength(socket) > 107) throw new Error('The project path is too long for the local Retry socket.');
  return socket;
}
