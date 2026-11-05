// Utility process: only local bytes and bundled resources, never URLs.
const path = require('node:path');
process.parentPort.once('message', async ({ data: { runtime, bytes } }) => {
  let worker;
  try {
    const { createWorker } = require(path.join(runtime, 'node_modules/tesseract.js'));
    worker = await createWorker(['chi_sim', 'eng'], 1, {
      workerPath: path.join(runtime, 'offline-worker.cjs'),
      langPath: path.join(runtime, 'models'),
      cacheMethod: 'none',
      logger: progress => process.parentPort.postMessage({ progress: { status: progress.status, progress: progress.progress } }),
    });
    const { data } = await worker.recognize(Buffer.from(bytes));
    process.parentPort.postMessage({ text: data.text });
  } catch {
    process.parentPort.postMessage({ error: '本地识别失败，请重试或手动填写' });
  } finally {
    await worker?.terminate();
  }
});
