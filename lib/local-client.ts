import { localRequest, saveScreenshots, getScreenshotUrl } from './local-store';
import { looksLikeImage, validateImage } from './domain';
import { uploadsSchema } from './schema';

async function upload(importId: string, files: File[]) {
    uploadsSchema.parse({ files: files.map(file => ({ name: file.name, mime: file.type, size: file.size })) });
    for (const file of files) {
        const issue = validateImage(file.type, file.size);
        if (issue) throw new Error(issue);
        const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
        if (!looksLikeImage(header, file.type)) throw new Error('文件内容与图片格式不符，请重新选择截图');
        let bitmap: ImageBitmap;
        try { bitmap = await createImageBitmap(file); }
        catch { throw new Error('图片无法解码，请重新截屏后上传'); }
        const pixels = bitmap.width * bitmap.height;
        bitmap.close();
        if (pixels > 40000000) throw new Error('截图尺寸过大，请将长图拆成几张上传');
    }
    return saveScreenshots(importId, files);
}

export const localClient = { request: localRequest, upload, image: getScreenshotUrl };
