const { app, BrowserWindow, dialog, ipcMain, net, protocol, session, shell } = require('electron');
const { readFile, writeFile } = require('node:fs/promises');
const { extname, isAbsolute, relative, resolve, sep } = require('node:path');

const scheme = 'octo';
const origin = 'octo://studio';
const accountServer = 'https://ai-octopus-api-l83b.onrender.com';
const assetRoot = app.isPackaged ? resolve(process.resourcesPath, 'studio') : resolve(__dirname, '../app');

protocol.registerSchemesAsPrivileged([{
  scheme,
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
}]);

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8'
};
const csp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "worker-src 'self' blob:",
  "connect-src 'self' https: http://localhost:* http://127.0.0.1:*",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'"
].join('; ');

function isStudioUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === scheme + ':' && url.host === 'studio' && !url.username && !url.password;
  } catch {
    return false;
  }
}

async function openExternal(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' || url.protocol === 'http:') await shell.openExternal(value);
  } catch (error) {
    console.error('Could not open external link:', error.message);
  }
}

async function serveWorkspace(request) {
  if (!isStudioUrl(request.url)) return new Response(null, { status: 404 });
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return requestAccountServer(request, url.pathname);
  if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405 });

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return new Response(null, { status: 400 });
  }
  if (pathname.includes('\\') || pathname.includes('\0')) return new Response(null, { status: 400 });

  const filename = resolve(assetRoot, '.' + (pathname === '/' ? '/index.html' : pathname));
  const withinRoot = relative(assetRoot, filename);
  if (withinRoot === '..' || withinRoot.startsWith('..' + sep) || isAbsolute(withinRoot)) {
    return new Response(null, { status: 403 });
  }

  try {
    const bytes = await readFile(filename);
    return new Response(request.method === 'HEAD' ? null : bytes, {
      headers: {
        'Content-Type': contentTypes[extname(filename).toLowerCase()] || 'application/octet-stream',
        'Content-Length': String(bytes.length),
        'Content-Security-Policy': csp,
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer'
      }
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}

async function requestAccountServer(request, path) {
  const routes = {
    GET: /^\/api\/(health|auth\/me|scans(\/[a-zA-Z0-9-]+)?|assistant\/status)$/,
    POST: /^\/api\/(auth\/(register|login)|scans|assistant)$/
  };
  if (!routes[request.method]?.test(path)) return Response.json({ error: 'This API endpoint is unavailable.' }, { status: 404 });
  const headers = new Headers({ Accept: 'application/json' });
  const token = request.headers.get('authorization');
  if (token) headers.set('Authorization', token);
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('Content-Type', contentType);
  try {
    const body = request.method === 'POST' ? await request.arrayBuffer() : undefined;
    if (body?.byteLength > 2 * 1024 * 1024) throw Error('Request too large.');
    const response = await net.fetch(accountServer + path, {
      method: request.method, headers, body, redirect: 'error', credentials: 'omit',
      signal: AbortSignal.timeout(44000)
    });
    return new Response(await response.arrayBuffer(), {
      status: response.status,
      headers: { 'Content-Type': response.headers.get('content-type') || 'application/octet-stream', 'Cache-Control': 'no-store' }
    });
  } catch {
    return Response.json({ error: 'Could not reach the Octo AI account server. Check your connection and try again.' }, { status: 502 });
  }
}

function configurePermissions() {
  const clipboardPermissions = ['clipboard-read', 'clipboard-sanitized-write'];
  session.defaultSession.setPermissionRequestHandler((contents, permission, done, details) => {
    const local = details.isMainFrame !== false && isStudioUrl(details.requestingUrl || contents.getURL());
    const video = permission === 'media' && details.mediaTypes?.length === 1 && details.mediaTypes[0] === 'video';
    done(local && (video || clipboardPermissions.includes(permission)));
  });
  session.defaultSession.setPermissionCheckHandler((_contents, permission, requestingOrigin, details) => {
    const local = details.isMainFrame !== false && isStudioUrl(requestingOrigin);
    return local && (clipboardPermissions.includes(permission) || (permission === 'media' && details.mediaType !== 'audio'));
  });
}

function createWindow() {
  const window = new BrowserWindow({
    show: false,
    title: 'Octo AI Studio',
    icon: resolve(assetRoot, 'assets/octo-icon.png'),
    width: 1360,
    height: 900,
    minWidth: 460,
    minHeight: 580,
    backgroundColor: '#10131e',
    autoHideMenuBar: true,
    webPreferences: {
      sandbox: true, contextIsolation: true, nodeIntegration: false,
      preload: resolve(__dirname, 'preload.cjs')
    }
  });
  window.setMenu(null);
  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    void openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (!isStudioUrl(url)) event.preventDefault();
  });
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.loadURL(origin + '/').catch(error => {
    console.error('Could not load Octo AI Studio:', error.message);
    app.exit(1);
  });
}

ipcMain.handle('octo:save-document', async (event, name, bytes) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || event.senderFrame !== event.sender.mainFrame || !isStudioUrl(event.senderFrame.url)) {
    throw Error('Invalid save request.');
  }
  if (typeof name !== 'string' || !name || name.length > 120 || /[<>:"/\\|?*\x00-\x1f]/.test(name)
    || !(bytes instanceof ArrayBuffer) || bytes.byteLength > 128 * 1024 * 1024) {
    throw Error('This document could not be saved. Check the filename and file size.');
  }
  const extension = extname(name).slice(1).toLowerCase();
  if (!['pdf', 'docx', 'txt', 'md', 'html', 'json'].includes(extension)) throw Error('Unsupported file type.');
  const choice = await dialog.showSaveDialog(window, {
    defaultPath: name, filters: [{ name: extension.toUpperCase() + ' file', extensions: [extension] }]
  });
  if (choice.canceled || !choice.filePath) return { saved: false };
  await writeFile(choice.filePath, Buffer.from(bytes));
  return { saved: true };
});

app.whenReady().then(() => {
  protocol.handle(scheme, serveWorkspace);
  configurePermissions();
  createWindow();
});
app.on('window-all-closed', () => app.quit());
