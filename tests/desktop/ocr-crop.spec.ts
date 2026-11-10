import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('框选范围用于真实离线OCR，恢复后保留范围，原始截图保持完整', async () => {
  test.setTimeout(120000);
  const profile = await mkdtemp(path.join(tmpdir(), 'offerdesk-crop-'));
  const app = await electron.launch({
    ...(process.env.OFFERDESK_TEST_EXECUTABLE ? { executablePath: process.env.OFFERDESK_TEST_EXECUTABLE } : {}),
    args: [...(process.env.OFFERDESK_TEST_EXECUTABLE ? [] : ['desktop']), `--user-data-dir=${profile}`],
  });
  try {
    const page = await app.firstWindow();
    await page.locator('.screenshot-action').click();
    const data = await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = 1700; canvas.height = 900;
      const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 1700, 900); ctx.fillStyle = '#000'; ctx.font = '48px Arial';
      ctx.fillText('Navigation Login Home', 80, 80);
      ctx.fillText('公司名称：区域科技', 80, 330);
      ctx.fillText('岗位名称：开发实习生', 80, 440);
      ctx.fillText('城市：杭州', 80, 550);
      ctx.fillText('Python FastAPI', 80, 660);
      ctx.fillText('NOISE', 1250, 330); ctx.fillText('Company Other', 1250, 440);
      return canvas.toDataURL('image/png').split(',')[1];
    });
    await page.locator('input[type=file]').setInputFiles({ name: 'crop-original.png', mimeType: 'image/png', buffer: Buffer.from(data, 'base64') });
    await page.getByRole('button', { name: '框选识别区域' }).click();
    await expect.poll(() => page.getByRole('img', { name: '待框选的原始截图' }).evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(1700);
    await page.locator('.crop-stage').scrollIntoViewIfNeeded();
    const stage = await page.locator('.crop-stage').boundingBox();
    if (!stage) throw new Error('框选图片未显示');
    await page.mouse.move(stage.x + stage.width * .05, stage.y + stage.height * .2);
    await page.mouse.down();
    await page.mouse.move(stage.x + stage.width * .65, stage.y + stage.height * .9);
    await page.mouse.up();
    await expect(page.getByLabel('左侧（%）')).toHaveValue('5');
    await page.getByLabel('宽度（%）').fill('99');
    await expect(page.getByRole('button', { name: '应用识别区域' })).toBeDisabled();
    await page.getByLabel('左侧（%）').fill('0'); await page.getByLabel('顶部（%）').fill('20');
    await page.getByLabel('宽度（%）').fill('65'); await page.getByLabel('高度（%）').fill('70');
    await page.screenshot({ path: 'test-results/ocr-crop-selection.png', animations: 'disabled' });
    await page.getByRole('button', { name: '应用识别区域' }).click();
    await expect(page.getByText('草稿已保存 · 数据保存在本机', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '关闭', exact: true }).click();
    await page.reload();
    await page.getByRole('button', { name: '继续上次导入', exact: true }).click();
    await page.getByRole('button', { name: '调整识别区域' }).click();
    await expect(page.getByLabel('顶部（%）')).toHaveValue('20');
    await expect(page.getByLabel('宽度（%）')).toHaveValue('65');
    await page.getByRole('button', { name: '取消框选' }).click();
    await page.getByRole('button', { name: '离线识别截图', exact: true }).click();
    const raw = page.getByLabel('识别原文（可修改）');
    await expect(raw).toHaveValue(/Python/, { timeout: 90000 });
    expect(await raw.inputValue()).not.toMatch(/NOISE|Navigation|Company Other/);
    await page.getByRole('button', { name: '根据文字预填', exact: true }).click();
    await expect(page.getByLabel(/公司名称/)).toHaveValue('区域科技');
    // Font rendering differs across OS runners; finish the required human review
    // before saving. This scenario verifies OCR cropping and original retention.
    await page.getByLabel(/岗位名称/).fill('开发实习生');
    await page.screenshot({ path: 'test-results/ocr-crop-review.png', animations: 'disabled' });
    await page.getByRole('button', { name: '保存到岗位列表', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.locator('.job-title-button:visible, .mobile-job-heading:visible').click();
    await page.getByText('原始招聘信息', { exact: false }).click();
    const img = page.getByRole('img', { name: 'crop-original.png', exact: true });
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(1700);
    expect(await img.evaluate((el: HTMLImageElement) => el.naturalHeight)).toBe(900);
  } finally {
    await Promise.all([app.waitForEvent('close'), app.evaluate(({ app }) => app.exit(0)).catch(() => {})]);
    await rm(profile, { recursive: true, force: true, maxRetries: 5 });
  }
});
