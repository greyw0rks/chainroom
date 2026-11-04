import net from 'node:net';

// WSL mirrored networking can fail to forward Docker's loopback listeners
// to Windows. Native loopback sockets give the browser a working path.
const ports = [[8066, 8065], [8082, 8080]];
const servers = ports.map(([port, target]) => {
  const server = net.createServer(client => {
    const upstream = net.connect({ host: '127.0.0.1', port: target });
    client.pipe(upstream).pipe(client);
    const close = () => { client.destroy(); upstream.destroy(); };
    client.on('error', close);
    upstream.on('error', close);
    client.on('close', () => upstream.destroy());
    upstream.on('close', () => client.destroy());
  });
  server.on('error', error => { console.error(`Browser relay ${port}: ${error.code}`); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`Browser access: http://localhost:${port} -> local service ${target}`));
  return server;
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  for (const server of servers) server.close();
});
