const { app, ipcMain, utilityProcess, nativeImage } = require('electron');
const path = require('node:path');
function registerOcr(getWindow) {
  let active;
  const authorized = event => event.sender === getWindow()?.webContents && event.senderFrame === event.sender.mainFrame && event.senderFrame.url === 'offerdesk://app/';
  ipcMain.handle('ocr:recognize', async (event, id, bytes) => {
    if (!authorized(event)) throw new Error('无权识别');
    if (active) throw new Error('正在识别，请稍候');
    if (typeof id !== 'string' || id.length > 100 || !(bytes instanceof Uint8Array) || !bytes.length || bytes.length > 40 * 1024 * 1024) throw new Error('图片无效');
    const image = nativeImage.createFromBuffer(Buffer.from(bytes));
    const size = image.getSize();
    if (image.isEmpty() || size.width * size.height > 40000000) throw new Error('图片无法解码或尺寸过大');
    const png = image.toPNG(); // Re-encode the validated image at the process boundary.
    const runtime = app.isPackaged ? path.join(process.resourcesPath, 'ocr-runtime') : path.join(__dirname, 'ocr-runtime');
    return new Promise((resolve, reject) => {
      const child = utilityProcess.fork(path.join(__dirname, 'ocr-process.cjs'));
      let done = false;
      const finish = (error, text) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        event.sender.removeListener('destroyed', destroyed);
        event.sender.removeListener('did-start-navigation', destroyed);
        event.sender.removeListener('render-process-gone', destroyed);
        active = null;
        child.kill();
        if (error) reject(new Error(error)); else resolve(text);
      };
      const destroyed = () => finish('识别已取消');
      const timer = setTimeout(() => finish('识别超时，请拆分长图后重试'), 180000);
      active = { id, cancel: destroyed };
      event.sender.once('destroyed', destroyed);
      event.sender.once('did-start-navigation', destroyed);
      event.sender.once('render-process-gone', destroyed);
      child.on('message', message => {
        if (done) return;
        if (message.progress) event.sender.send('ocr:progress', { id, ...message.progress });
        else finish(message.error, message.text);
      });
      child.once('exit', () => finish('识别进程已退出，请重试'));
      child.postMessage({ runtime, bytes: new Uint8Array(png) });
    });
  });
  ipcMain.handle('ocr:cancel', (event, id) => { if (authorized(event) && active?.id === id) active.cancel(); });
  app.on('before-quit', () => active?.cancel());
}
module.exports = { registerOcr };
