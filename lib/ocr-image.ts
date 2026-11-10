export type OcrRegion = { x: number; y: number; width: number; height: number };

/** Bounded preprocessing: preserve the original attachment and only crop the OCR input. */
export function ocrImagePlan(width: number, height: number, region?: OcrRegion) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > 40000000) throw new Error('截图尺寸过大或无效，请拆分后识别');
    const crop = region || { x: 0, y: 0, width: 1, height: 1 };
    if (![crop.x, crop.y, crop.width, crop.height].every(Number.isFinite)
        || crop.x < 0 || crop.y < 0 || crop.width <= 0 || crop.height <= 0
        || crop.x + crop.width > 1.000001 || crop.y + crop.height > 1.000001) throw new Error('识别区域无效，请重新框选');
    const x = Math.floor(crop.x * width), y = Math.floor(crop.y * height);
    const w = Math.min(width - x, Math.max(1, Math.round(crop.width * width)));
    const h = Math.min(height - y, Math.max(1, Math.round(crop.height * height)));
    // Enlarge narrow screenshots without exceeding the IPC image pixel limit.
    const scale = Math.min(2, Math.max(1, 1600 / w), Math.sqrt(40000000 / (w * h)));
    return { x, y, width: w, height: h, outputWidth: Math.max(1, Math.floor(w * scale)), outputHeight: Math.max(1, Math.floor(h * scale)) };
}
