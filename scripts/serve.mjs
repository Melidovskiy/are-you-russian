import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { apiResponse } from '../src/server/api.js';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const port = Number(process.env.PORT || 4321);
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
};
const compressible = new Set(['.html', '.js', '.css', '.svg']);

function cacheControlFor(ext) {
  if (ext === '.woff2') return 'public, max-age=31536000, immutable';
  if (ext === '.css' || ext === '.js' || ext === '.png' || ext === '.svg') return 'public, max-age=300';
  return 'no-cache';
}

const server = createServer(async (request, response) => {
  let url;
  try { url = new URL(request.url, 'http://localhost'); }
  catch { response.writeHead(400).end('Bad request'); return; }
  if (['/api/ip', '/api/check'].includes(url.pathname)) {
    const result = await apiResponse(url.pathname, new Request(url, { method: request.method, headers: request.headers }), request.socket.remoteAddress);
    response.writeHead(result.status, Object.fromEntries(result.headers));
    response.end(Buffer.from(await result.arrayBuffer()));
    return;
  }
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/guides' || /^\/guides\/[a-z0-9-]+$/.test(pathname)) {
      response.writeHead(308, { Location: `${pathname}/${url.search}` }).end();
      return;
    }
    const relative = pathname.endsWith('/') ? `${pathname.slice(1)}index.html` : pathname.slice(1);
    if (relative.includes('\\') || !/^(?:index\.html|(?:app|guides|theme-init)\.js|LICENSE|guides\/(?:[a-z0-9-]+\/)?index\.html|(?:src|assets|downloads)\/[^.][^\0]*)$/.test(relative)) {
      response.writeHead(404).end('Not found');
      return;
    }
    const filename = path.resolve(root, relative);
    if (!filename.startsWith(root) || !(await stat(filename)).isFile()) {
      response.writeHead(404).end('Not found');
      return;
    }
    const ext = path.extname(filename);
    const raw = await readFile(filename);
    const useGzip = compressible.has(ext) && /\bgzip\b/i.test(request.headers['accept-encoding'] || '');
    const body = useGzip ? gzipSync(raw) : raw;
    const headers = {
      'Content-Type': types[ext] || 'text/plain; charset=utf-8',
      'Content-Length': body.byteLength,
      'Cache-Control': cacheControlFor(ext),
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    };
    if (useGzip) {
      headers['Content-Encoding'] = 'gzip';
      headers['Vary'] = 'Accept-Encoding';
    }
    response.writeHead(200, headers);
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(404).end('Not found');
  }
});
server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`http://127.0.0.1:${port}`));
