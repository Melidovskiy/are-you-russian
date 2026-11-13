import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const port = Number(process.env.PORT || 4321);
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.woff2': 'font/woff2',
};

const server = createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (relative.includes('\\') || !/^(?:index\.html|app\.js|LICENSE|(?:src|assets)\/[^.][^\0]*)$/.test(relative)) {
      response.writeHead(404).end('Not found');
      return;
    }
    const filename = path.resolve(root, relative);
    if (!filename.startsWith(root) || !(await stat(filename)).isFile()) {
      response.writeHead(404).end('Not found');
      return;
    }
    const body = await readFile(filename);
    response.writeHead(200, {
      'Content-Type': types[path.extname(filename)] || 'text/plain; charset=utf-8',
      'Content-Length': body.byteLength, 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(404).end('Not found');
  }
});
server.listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}`));
