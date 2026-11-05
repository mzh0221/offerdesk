const { app, BrowserWindow, Menu, dialog, net, protocol, session, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { APP_URL, isAppUrl, externalUrl, resolveAsset } = require('./policy.cjs');

app.setName('OfferDesk');
// Keep the application's profile and origin stable across upgrades and installers.
const profile = process.argv.find(value => value.startsWith('--user-data-dir='));
if (profile) {
  const directory = path.resolve(profile.slice('--user-data-dir='.length));
  fs.mkdirSync(directory, { recursive: true });
  app.setPath('userData', directory);
}
protocol.registerSchemesAsPrivileged([
  { scheme: 'offerdesk', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

let window;

async function openExternal(value) {
  const url = externalUrl(value);
  if (url) await shell.openExternal(url).catch(() => {});
}

async function createWindow() {
  window = new BrowserWindow({
    title: 'OfferDesk · 岗位投递台',
    width: 1360,
    height: 900,
    minWidth: 760,
    minHeight: 560,
    backgroundColor: '#f7f8fc',
    show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true },
  });
  window.once('ready-to-show', () => window?.show());
  window.on('closed', () => { window = null; });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('blob:offerdesk://app/')) {
      const preview = new BrowserWindow({
        title: '岗位截图', width: 1000, height: 800,
        webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true },
      });
      preview.setMenu(null);
      preview.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      preview.webContents.on('will-navigate', event => event.preventDefault());
      void preview.loadURL(`${APP_URL}image.html#${encodeURIComponent(url)}`);
      return { action: 'deny' };
    }
    void openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', event => {
    if (!isAppUrl(event.url)) {
      event.preventDefault();
      void openExternal(event.url);
    }
  });
  window.webContents.on('will-frame-navigate', event => {
    if (!isAppUrl(event.url)) event.preventDefault();
  });
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  await window.loadURL(APP_URL);
}

function menu() {
  const mac = process.platform === 'darwin';
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(mac ? [{ label: 'OfferDesk', submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { type: 'separator' }, { role: 'quit' }] }] : []),
    { label: '文件', submenu: [
      { label: '打开数据目录', click: () => { void shell.openPath(app.getPath('userData')); } },
      { type: 'separator' },
      { role: mac ? 'close' : 'quit' },
    ] },
    { label: '编辑', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: '视图', submenu: [{ role: 'reload' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }] },
    { label: '帮助', submenu: [
      { label: 'GitHub 项目', click: () => { void openExternal('https://github.com/mzh0221/offerdesk'); } },
      { label: '关于数据保存', click: () => { void dialog.showMessageBox({ type: 'info', title: '本地数据', message: '岗位和截图保存在当前应用的数据目录中。', detail: '关闭应用后记录会保留。可通过“文件 → 打开数据目录”查看保存位置。' }); } },
    ] },
  ]));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  });
  app.whenReady().then(async () => {
    const root = path.join(__dirname, 'renderer-dist');
    protocol.handle('offerdesk', request => {
      const file = resolveAsset(root, request.url);
      if (!file || request.method !== 'GET') return new Response('Not found', { status: 404 });
      return net.fetch(pathToFileURL(file).toString());
    });
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    // Local management never loads remote pages, scripts, or cloud services.
    session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_details, callback) => callback({ cancel: true }));
    session.defaultSession.on('will-download', (_event, item) => {
      if (!item.getURL().startsWith('blob:offerdesk://app/')) item.cancel();
    });
    require('./ocr.cjs').registerOcr(() => window);
    menu();
    await createWindow();
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) void createWindow(); });
  }).catch(error => {
    dialog.showErrorBox('OfferDesk 无法启动', String(error.message || error));
    app.quit();
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
