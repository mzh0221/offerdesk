'use client';
import { demoRequest, demoUpload, demoImage } from './demo';
import { browserClient } from './supabase/browser';
import { validateImage } from './domain';
export function clientApi(demo: boolean) {
    async function request(path: string, method = 'GET', body?: unknown): Promise<any> {
        if (demo)
            return demoRequest(path, method, body as Record<string, unknown>);
        const response = await fetch(`/api/${path}`, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
        const data = await response.json();
        if (!response.ok)
            throw new Error(data.error || '请求失败');
        return data;
    }
    async function upload(importId: string, files: File[]) {
        for (const file of files) {
            const error = validateImage(file.type, file.size);
            if (error)
                throw new Error(error);
            if (typeof createImageBitmap === 'function') {
                let bitmap: ImageBitmap;
                try {
                    bitmap = await createImageBitmap(file);
                }
                catch {
                    throw new Error('图片无法解码，请重新截屏后上传');
                }
                const pixels = bitmap.width * bitmap.height;
                bitmap.close();
                if (pixels > 40000000)
                    throw new Error('截图尺寸过大，请将长图拆成几张上传');
            }
        }
        if (demo)
            return demoUpload(importId, files);
        const uploads = await request(`imports/${importId}/uploads`, 'POST', { files: files.map(f => ({ name: f.name, mime: f.type, size: f.size })) });
        const storage = browserClient().storage.from('screenshots');
        for (const [i, upload] of uploads.entries()) {
            const { error } = await storage.uploadToSignedUrl(upload.path, upload.token, files[i], { contentType: files[i].type });
            if (error)
                throw new Error('图片上传失败，请新建导入后重试');
        }
    }
    async function image(id: string) { return demo ? demoImage(id) : (await request(`attachments/${id}`)).url as string; }
    return { request, upload, image };
}
