import test from 'node:test';
import assert from 'node:assert/strict';
import { ocrImagePlan } from '../lib/ocr-image.ts';

test('识别输入裁剪并放大小图，原图尺寸不改变', () => {
    assert.deepEqual(ocrImagePlan(1200, 800, { x: .25, y: .25, width: .5, height: .5 }), { x: 300, y: 200, width: 600, height: 400, outputWidth: 1200, outputHeight: 800 });
    assert.equal(ocrImagePlan(2000, 3000).outputWidth, 2000);
});
test('识别区域拒绝越界和非数值；放大后仍受4000万像素约束', () => {
    for (const x of [-1, NaN, Infinity, .9]) assert.throws(() => ocrImagePlan(100, 100, { x, y: 0, width: .5, height: 1 }));
    assert.throws(() => ocrImagePlan(100, 100, { x: 0, y: 0, width: 0, height: 1 }));
    const plan = ocrImagePlan(1000, 39000);
    assert.ok(plan.outputWidth * plan.outputHeight <= 40000000);
});
