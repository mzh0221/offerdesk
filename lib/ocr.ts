export type OcrProgress = { id: string; status: string; progress: number };
declare global {
  interface Window {
    localOcr?: {
      recognize(id: string, bytes: Uint8Array): Promise<string>;
      cancel(id: string): Promise<void>;
      onProgress(callback: (progress: OcrProgress) => void): () => void;
    };
  }
}
export async function recognizeScreenshot(blob: Blob, signal: AbortSignal, progress: (value: number) => void): Promise<string> {
  const bridge = window.localOcr;
  if (!bridge) throw new Error('本地识别组件不可用，请重启应用');
  if (signal.aborted) throw new Error('识别已取消');
  const id = crypto.randomUUID();
  if (blob.size > 5 * 1024 * 1024) throw new Error('每张图片不能超过5MB');
  const bitmap = await createImageBitmap(blob);
  let normalized: Blob;
  try {
    if (bitmap.width * bitmap.height > 40000000) throw new Error('截图尺寸过大，请拆分后识别');
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
    normalized = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('图片转换失败')), 'image/png'));
  } finally { bitmap.close(); }
  const bytes = new Uint8Array(await normalized.arrayBuffer());
  if (signal.aborted) throw new Error('识别已取消');
  const unsubscribe = bridge.onProgress(event => {
    if (event.id === id) progress(event.status === 'recognizing text' ? event.progress : 0);
  });
  const cancel = () => { void bridge.cancel(id); };
  signal.addEventListener('abort', cancel, { once: true });
  try { return await bridge.recognize(id, bytes); }
  finally { signal.removeEventListener('abort', cancel); unsubscribe(); }
}
