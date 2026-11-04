import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { root } from './lib/switch.mjs';
import { selectedProviderKey } from './lib/provider-key.mjs';

// Forward the native request unchanged. Record only request sizes and the
// provider's failure reason; never headers, credentials or prompt content.
const config = JSON.parse(await readFile(resolve(root, '.runtime/provider-diagnostic.json'), 'utf8'));
const directory = resolve(root, '.runtime/evidence');
await mkdir(directory, { recursive: true, mode: 0o700 });
const records = [];
const server = createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    let metadata = {};
    try {
      const parsed = JSON.parse(body);
      metadata = { model: parsed.model, tools: parsed.tools?.length, input_items: parsed.input?.length, request_bytes: body.length,
        request_keys: Object.keys(parsed), reasoning: parsed.reasoning, service_tier: parsed.service_tier,
        auth_matches_configured_key: req.headers.authorization === `Bearer ${process.env.CODEX_GATEWAY_API_KEY}`,
        user_agent: req.headers['user-agent'] };
    } catch {}
    console.log(JSON.stringify({ request: metadata }));
    const headers = { ...req.headers };
    const selected = await selectedProviderKey();
    if (selected) headers.authorization = `Bearer ${selected}`;
    delete headers.host; delete headers.connection; delete headers['content-length'];
    const upstream = await fetch(config.upstream + req.url, {
      method: req.method, headers, ...(body.length ? { body } : {}), signal: AbortSignal.timeout(180000)
    });
    const returned = Object.fromEntries(upstream.headers);
    delete returned['content-length']; delete returned['content-encoding']; delete returned['transfer-encoding'];
    res.writeHead(upstream.status, returned);
    let pending = '';
    for await (const chunk of Readable.fromWeb(upstream.body)) {
      res.write(chunk);
      pending += chunk.toString();
      const lines = pending.split('\n'); pending = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const event = JSON.parse(line.slice(6));
          if (event.type === 'response.failed' || event.type === 'error') {
            const record = { timestamp: new Date().toISOString(), status: upstream.status, ...metadata,
              error: event.response?.error ?? event.error ?? { code: event.code, message: event.message } };
            records.push(record);
            await writeFile(resolve(directory, 'provider-diagnostic.json'), JSON.stringify(records, null, 2), { mode: 0o600 });
            console.log(JSON.stringify(record));
          }
        } catch {}
      }
    }
    res.end();
  } catch (error) { res.writeHead(502); res.end(); console.log(JSON.stringify({ error: error.cause?.code ?? error.name })); }
});
server.listen(8093, '127.0.0.1', () => console.log('Native provider diagnostic relay listening on loopback:8093.'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
