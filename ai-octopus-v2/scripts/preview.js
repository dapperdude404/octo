// Dependency-free frontend preview for Windows, macOS and Linux.
// Serves only the local frontend; commercial provider routes and accounts are not available.
import http from 'node:http';
import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../web');
const repositoryVendor = path.resolve(root, '../../app/vendor');
const port = Number(process.env.PREVIEW_PORT) || 4173;
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json; charset=utf-8', '.png':'image/png', '.ico':'image/x-icon', '.mjs':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.webp':'image/webp', '.woff2':'font/woff2', '.ttf':'font/ttf', '.txt':'text/plain; charset=utf-8' };
const server = http.createServer(async (request,response)=>{
  if (!['GET','HEAD'].includes(request.method)) {response.writeHead(405); response.end(); return;}
  let pathname;
  try {pathname = decodeURIComponent(new URL(request.url,'http://localhost').pathname);}catch{response.writeHead(400);response.end();return;}
  const shared = pathname.startsWith('/vendor/');
  const allowedRoot = shared ? repositoryVendor : root;
  const relativePath = shared ? pathname.slice('/vendor'.length) : pathname === '/' ? '/index.html' : pathname;
  const filename = path.resolve(allowedRoot, '.' + relativePath);
  if (filename !== allowedRoot && !filename.startsWith(allowedRoot + path.sep)){response.writeHead(403);response.end();return;}
  try {
    if (!(await stat(filename)).isFile()) throw Error('Not a file');
    const bytes = await readFile(filename);
    response.writeHead(200, {'content-type':types[path.extname(filename)]||'application/octet-stream', 'cache-control':'no-store', 'x-content-type-options':'nosniff'});
    response.end(request.method === 'HEAD'?undefined:bytes);
  } catch {response.writeHead(404, {'content-type':'text/plain; charset=utf-8'});response.end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log(`AI Octopus demo: http://127.0.0.1:${port}`));
