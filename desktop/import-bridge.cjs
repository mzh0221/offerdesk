const net = require('node:net');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomBytes, randomUUID, timingSafeEqual } = require('node:crypto');
const MAX_BYTES = 4 * 1024 * 1024;
const connectionFile = directory => path.join(directory, 'mcp-connection.json');
function authenticated(value, expected) {
  return typeof value === 'string' && Buffer.byteLength(value) === Buffer.byteLength(expected) && timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}
function registerImportBridge(app, ipcMain, getWindow) {
  const token = randomBytes(32).toString('hex');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'offerdesk-mcp-'));
  fs.chmodSync(directory, 0o700);
  const socketPath = process.platform === 'win32' ? `\\\\.\\pipe\\offerdesk-${randomUUID()}` : path.join(directory, 'bridge.sock');
  const pending = new Map();
  const sockets = new Set();
  let ready = false;
  const authorized = event => {
    const window = getWindow();
    return window && event.sender === window.webContents && event.senderFrame === event.sender.mainFrame && event.senderFrame.url === 'offerdesk://app/';
  };
  ipcMain.on('external-import:ready', event => { if (authorized(event)) ready = true; });
  ipcMain.on('external-import:result', (event, id, response) => {
    if (!authorized(event) || !pending.has(id)) return;
    pending.get(id)(response);
  });
  app.on('web-contents-created', (_event, contents) => {
    contents.on('did-start-loading', () => { if (contents === getWindow()?.webContents) ready = false; });
    contents.on('destroyed', () => { if (contents === getWindow()?.webContents) ready = false; });
  });
  const server = net.createServer(socket => {
    sockets.add(socket); socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {}); socket.setTimeout(35000, () => socket.destroy());
    let buffer = ''; let bytes = 0; let handled = false;
    const reply = response => { if (!socket.destroyed) socket.end(JSON.stringify(response) + '\n'); };
    socket.on('data', chunk => {
      if (handled) return;
      bytes += Buffer.byteLength(chunk);
      if (bytes > MAX_BYTES) { handled = true; reply({ error: '请求超过 4MB' }); return; }
      buffer += chunk.toString('utf8');
      if (!buffer.includes('\n')) return;
      handled = true;
      let request;
      try { request = JSON.parse(buffer.slice(0, buffer.indexOf('\n'))); } catch { reply({ error: '无效 JSON' }); return; }
      if (!request || !authenticated(request.token, token)) { reply({ error: '未授权连接' }); return; }
      const window = getWindow();
      if (!ready || !window || window.isDestroyed() || window.webContents.isLoadingMainFrame()) { reply({ error: '请先打开 OfferDesk 并等待页面加载完成' }); return; }
      if (pending.size >= 8) { reply({ error: '导入繁忙，请稍后重试' }); return; }
      const id = randomUUID();
      const timer = setTimeout(() => finish({ error: '导入结果未知，请使用原批次重试' }), 30000);
      function finish(response) { clearTimeout(timer); pending.delete(id); reply(response); }
      pending.set(id, finish);
      socket.on('close', () => { clearTimeout(timer); pending.delete(id); });
      window.webContents.send('external-import:request', id, request.body);
    });
    // Decode UTF-8 across chunks, including Chinese content.
    socket.setEncoding('utf8');
  });
  const descriptor = connectionFile(app.getPath('userData'));
  server.on('error', error => { console.error('OfferDesk MCP bridge:', error.message); });
  server.listen(socketPath, () => {
    if (process.platform !== 'win32') fs.chmodSync(socketPath, 0o600);
    fs.writeFileSync(descriptor, JSON.stringify({ socket: socketPath, token }), { mode: 0o600 });
    fs.chmodSync(descriptor, 0o600);
  });
  app.on('will-quit', () => {
    for (const finish of pending.values()) finish({ error: '应用退出，导入结果未知，请使用原批次重试' });
    for (const socket of sockets) socket.destroy();
    server.close();
    try { fs.unlinkSync(descriptor); } catch {}
    try { fs.rmSync(directory, { recursive: true, force: true }); } catch {}
  });
}
module.exports = { registerImportBridge, connectionFile, MAX_BYTES };
