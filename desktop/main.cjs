const { app, BrowserWindow, protocol, session, shell } = require('electron');
const { readFile } = require('node:fs/promises');
const { extname, isAbsolute, relative, resolve, sep } = require('node:path');

const scheme = 'octo';
const origin = 'octo://studio';
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
  if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405 });

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url).pathname);
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
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
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

app.whenReady().then(() => {
  protocol.handle(scheme, serveWorkspace);
  configurePermissions();
  createWindow();
});
app.on('window-all-closed', () => app.quit());
