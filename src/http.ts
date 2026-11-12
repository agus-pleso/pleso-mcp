#!/usr/bin/env node
/**
 * Remote MCP endpoint (Streamable HTTP, stateless) — what ChatGPT, Claude,
 * Perplexity, Gemini and other hosted clients connect to.
 *
 *   POST /mcp            MCP JSON-RPC
 *   GET  /health         liveness (/healthz also works locally; reserved at Google's edge)
 *   GET  /               human-readable info
 *   GET  /.well-known/openai-apps-challenge   ChatGPT domain verification (env OPENAI_APPS_CHALLENGE)
 *
 * Privacy: request bodies (which contain search terms) are never logged.
 */
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { PlesoWebCatalog } from './catalog.js';
import { PUBLIC_URL, type Page, getPage } from './pages.js';
import { SERVER_NAME, SERVER_VERSION, createServer } from './server.js';

const PORT = Number(process.env.PORT ?? 8080);
const MAX_BODY = 256 * 1024;
const WARM_UP_MAX_MS = Number(process.env.WARM_UP_MAX_SECONDS ?? 90) * 1000;
const catalog = new PlesoWebCatalog();

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id, Mcp-Protocol-Version',
};

function send(res: ServerResponse, status: number, body: unknown, type = 'application/json') {
  res.writeHead(status, { ...CORS, 'Content-Type': type });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw Object.assign(new Error('Payload too large'), { status: 413 });
    chunks.push(chunk as Buffer);
  }
  if (!size) return undefined;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('Invalid JSON'), { status: 400 });
  }
}

async function handleMcp(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    // Stateless server: no standalone SSE stream and no sessions to delete.
    res.writeHead(405, { ...CORS, Allow: 'POST, OPTIONS', 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed' }, id: null }));
    return;
  }
  const body = await readJson(req);
  const server = createServer(catalog);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on('close', () => {
    void transport.close();
    void server.close();
  });
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
  await server.connect(transport);
  await transport.handleRequest(req, res, body);
}

const http = createHttpServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const started = Date.now();
  let page: Page | null = null;
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS);
      res.end();
    } else if (url.pathname === '/mcp' || url.pathname === '/mcp/') {
      await handleMcp(req, res);
    } else if (url.pathname === '/health' || url.pathname === '/healthz') {
      // Note: Cloud Run / App Hosting reserve /healthz at the edge — use /health there.
      send(res, 200, { ok: true, name: SERVER_NAME, version: SERVER_VERSION });
    } else if (url.pathname === '/.well-known/openai-apps-challenge' && process.env.OPENAI_APPS_CHALLENGE) {
      send(res, 200, process.env.OPENAI_APPS_CHALLENGE, 'text/plain');
    } else if ((req.method === 'GET' || req.method === 'HEAD') && (page = getPage(url.pathname, req.headers.accept))) {
      res.writeHead(page.status, { ...CORS, 'Content-Type': page.type, ...page.headers });
      res.end(req.method === 'HEAD' ? undefined : page.body);
    } else if (url.pathname === '/' && req.method === 'GET') {
      send(res, 200, {
        name: 'Pleso Therapy — therapist finder (MCP)',
        version: SERVER_VERSION,
        mcp_endpoint: '/mcp',
        transport: 'streamable-http',
        auth: 'none',
        docs: `${PUBLIC_URL}/docs`,
        privacy: `${PUBLIC_URL}/privacy`,
      });
    } else {
      send(res, 404, { error: 'Not found' });
    }
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    if (status >= 500) console.error('[pleso-mcp] error:', (err as Error).message);
    if (!res.headersSent) send(res, status, { jsonrpc: '2.0', error: { code: -32603, message: status >= 500 ? 'Internal error' : (err as Error).message }, id: null });
  } finally {
    // Access log without bodies or query strings.
    res.on('finish', () => console.log(`${req.method} ${url.pathname} ${res.statusCode} ${Date.now() - started}ms`));
  }
});

// Load the catalog before accepting traffic: on Cloud Run / App Hosting the CPU is
// throttled between requests, so background warm-up would barely progress. Time-boxed
// so an outage at pleso.me can never block startup.
const warm =
  process.env.WARM_UP === 'false'
    ? Promise.resolve()
    : Promise.race([catalog.warmUp(), new Promise<void>((r) => setTimeout(r, WARM_UP_MAX_MS).unref())]);
void warm.then(() => http.listen(PORT, () => console.log(`Pleso MCP listening on :${PORT}/mcp`)));
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => http.close(() => process.exit(0)));
