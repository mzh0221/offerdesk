const { app, BrowserWindow, Menu, clipboard, dialog, net, protocol, session, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { APP_URL, isAppUrl, externalUrl, resolveAsset } = require('./policy.cjs');

app.setName('OfferDesk');
if (process.argv.includes('--offerdesk-mcp')) {
  const directory = process.argv.find(value => value.startsWith('--user-data-dir='))?.slice('--user-data-dir='.length);
  require('./mcp-stdio.cjs').start(directory, () => app.quit());
} else if (process.argv.includes('--offerdesk-import')) {
  process.stderr.write('文件导入已移除，请通过 MCP 的 import_jobs 导入岗位。\n', () => app.exit(1));
} else {
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
const autoPlans = new Map();
let autoApplying = false;
let serviceCheck;

function currentHarnessConfigs() {
  const args = [...(app.isPackaged ? [] : [app.getAppPath()]), '--offerdesk-mcp', ...(profile ? [profile] : [])];
  return require('./harness-config.cjs').harnessConfigs(process.execPath, args);
}
function authorizeImportUi(event) {
  if (event.sender !== window?.webContents || event.senderFrame !== event.sender.mainFrame || event.senderFrame.url !== APP_URL) throw new Error('未授权请求');
}
function checkLocalMcp() {
  if (!serviceCheck) serviceCheck = require('./auto-mcp.cjs').checkService(currentHarnessConfigs()[0].connection).finally(() => { serviceCheck = null; });
  return serviceCheck;
}

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
  window.webContents.on('will-prevent-unload', event => {
    const choice = dialog.showMessageBoxSync(window, {
      type: 'question', title: '有未保存的内容', message: '当前内容尚未保存，仍要离开吗？',
      detail: '选择“继续编辑”返回应用并保存内容。', buttons: ['继续编辑', '放弃未保存内容并离开'], defaultId: 0, cancelId: 0,
    });
    if (choice === 1) event.preventDefault();
  });
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
    require('electron').ipcMain.handle('external-import:configs', event => {
      authorizeImportUi(event);
      return currentHarnessConfigs();
    });
    require('electron').ipcMain.handle('external-import:copy', (event, text) => {
      authorizeImportUi(event);
      const allowed = new Set(currentHarnessConfigs().flatMap(config => [config.config, config.taskPrompt, config.verifyPrompt, config.connection?.command, config.connection?.cwd, ...(config.connection?.args || [])]).filter(value => typeof value === 'string'));
      if (typeof text !== 'string' || !allowed.has(text)) throw new Error('只能复制当前接入页面提供的配置与提示词');
      clipboard.writeText(text);
    });
    require('electron').ipcMain.handle('external-import:auto-prepare', (event, id, variant = 'desktop') => {
      authorizeImportUi(event);
      const config = currentHarnessConfigs().find(item => item.id === id);
      if (!config || typeof variant !== 'string') throw new Error('请选择支持的 MCP 工具。');
      const automatic = require('./auto-mcp.cjs');
      const plan = automatic.prepare(config, variant, { homeDir: app.getPath('home'), appDataDir: app.getPath('appData'), env: process.env });
      for (const [key, value] of autoPlans) if (Date.now() - value.createdAt > 5 * 60 * 1000) autoPlans.delete(key);
      if (autoPlans.size >= 8) autoPlans.delete(autoPlans.keys().next().value);
      const token = plan.ready ? require('node:crypto').randomUUID() : '';
      if (plan.ready) autoPlans.set(token, plan);
      return automatic.publicPlan(plan, token);
    });
    require('electron').ipcMain.handle('external-import:auto-apply', async (event, token) => {
      authorizeImportUi(event);
      if (autoApplying) throw new Error('正在配置，请稍后重试。');
      const plan = typeof token === 'string' && autoPlans.get(token);
      if (!plan) throw new Error('请先检测并预览配置。');
      autoPlans.delete(token);
      autoApplying = true;
      try {
        await require('./auto-mcp.cjs').apply(plan);
        return { target: plan.target, message: '本机 offerdesk 配置已写入。请在 AI 工具中重新加载 MCP 并验证连接。' };
      } finally { autoApplying = false; }
    });
    require('electron').ipcMain.handle('external-import:service-check', event => {
      authorizeImportUi(event);
      return checkLocalMcp();
    });
    require('./ocr.cjs').registerOcr(() => window);
    require('./import-bridge.cjs').registerImportBridge(app, require('electron').ipcMain, () => window);
    menu();
    await createWindow();
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) void createWindow(); });
  }).catch(error => {
    dialog.showErrorBox('OfferDesk 无法启动', String(error.message || error));
    app.quit();
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}

}
