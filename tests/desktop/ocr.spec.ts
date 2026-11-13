import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('全新环境离线 OCR、编辑预填、原文保存与重启', async () => {
  test.setTimeout(180000);
  const profile = await mkdtemp(path.join(tmpdir(), 'offerdesk-ocr-'));
  const launch = () => electron.launch({
    ...(process.env.OFFERDESK_TEST_EXECUTABLE ? { executablePath: process.env.OFFERDESK_TEST_EXECUTABLE } : {}),
    args: [...(process.env.OFFERDESK_TEST_EXECUTABLE ? [] : ['desktop']), `--user-data-dir=${profile}`],
  });
  let app = await launch();
  try {
    let page = await app.firstWindow();
    await expect(page.getByRole('heading', { name: '让 AI 帮你找机会', exact: true })).toBeVisible();
    // OCR worker itself denies HTTP/HTTPS and fetch; models come from the bundle.
    const data = await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = 1400; canvas.height = 760;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 1400, 760); ctx.fillStyle = '#000'; ctx.font = '48px Arial';
      ['OfferDesk Internship', 'Software Engineer', 'Salary 200 per day', 'TypeScript React', '公司名称：示例科技', '岗位名称：开发实习生'].forEach((text, i) => ctx.fillText(text, 50, 90 + i * 110));
      return canvas.toDataURL('image/webp', 0.98).split(',')[1];
    });
    await page.locator('.screenshot-action').click();
    const blank = await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = 500; canvas.height = 200;
      const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 500, 200);
      return canvas.toDataURL('image/png').split(',')[1];
    });
    await page.locator('input[type="file"]').setInputFiles([
      { name: 'ocr.webp', mimeType: 'image/webp', buffer: Buffer.from(data, 'base64') },
      { name: 'blank.png', mimeType: 'image/png', buffer: Buffer.from(blank, 'base64') },
    ]);
    await page.getByRole('button', { name: '离线识别截图', exact: true }).click();
    await page.getByRole('button', { name: '取消识别', exact: true }).click();
    await expect(page.getByText('识别已取消，已完成的文字仍可使用', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '重新识别截图', exact: true }).click();
    const raw = page.getByLabel('识别原文（可修改）');
    await expect(raw).toBeVisible({ timeout: 120000 });
    await expect(raw).toHaveValue(/Software Engineer/, { timeout: 120000 });
    await expect(page.getByText(/blank.png：未识别到文字/)).toBeVisible();
    const corrected = '人工核对后纠正的招聘信息';
    await raw.fill(corrected);
    await page.getByRole('button', { name: '重试未完成截图', exact: true }).click();
    await expect(page.getByRole('button', { name: '重试未完成截图', exact: true })).toBeEnabled();
    await expect(raw).toHaveValue(corrected);
    // A successful retry also leaves edits untouched and exposes its new text separately.
    await page.evaluate(() => {
      const image = document.querySelector('.upload-preview img') as HTMLImageElement;
      const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      canvas.getContext('2d')!.drawImage(image, 0, 0);
      // Replace only the File returned to OCR; the UI selection and persisted files stay real.
      const original = createImageBitmap;
      (window as any).__originalBitmap = original;
      window.createImageBitmap = (async (image: ImageBitmapSource) => {
        const bitmap = await original(image);
        if (bitmap.width === 500 && bitmap.height === 200) { bitmap.close(); return original(canvas); }
        return bitmap;
      }) as typeof createImageBitmap;
    });
    await page.getByRole('button', { name: '重试此图', exact: true }).click();
    await expect(page.getByLabel('重试新增文字')).toHaveValue(/Software Engineer/, { timeout: 120000 });
    await expect(raw).toHaveValue(corrected);
    await page.getByRole('button', { name: '插入原文', exact: true }).click();
    await expect(raw).toHaveValue(/人工核对后纠正的招聘信息[\s\S]*Software Engineer/);
    await expect(page.getByLabel('重试新增文字')).toHaveCount(0);
    await page.evaluate(() => { window.createImageBitmap = (window as any).__originalBitmap; });
    await raw.fill('公司名称：离线识别测试\n岗位名称：开发实习生\n城市：杭州\n薪资：200元/天\n任职要求：\nTypeScript React');
    await page.getByRole('button', { name: '根据文字预填', exact: true }).click();
    await expect(page.getByLabel(/公司名称/)).toHaveValue('离线识别测试');
    await expect(page.getByLabel(/岗位名称/)).toHaveValue('开发实习生');
    await page.getByLabel('技能标签', { exact: true }).fill('React,TypeScript,');
    await page.getByLabel(/必备技能/).fill('TypeScript React\n');
    await page.screenshot({ path: 'test-results/ocr-review.png', fullPage: true });
    await page.getByRole('button', { name: '保存到岗位列表', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await app.close();
    app = await launch(); page = await app.firstWindow();
    await page.getByLabel('搜索公司、岗位或技能').fill('离线识别测试');
    await expect(page.locator('.jobs-table tbody tr')).toHaveCount(1);
    await page.locator('.job-title-button:visible, .mobile-job-heading:visible').click();
    await page.getByText('原始招聘信息', { exact: false }).click();
    await expect(page.locator('pre')).toContainText('薪资：200元/天');
    await expect(page.getByRole('img', { name: 'ocr.webp', exact: true })).toBeVisible();
  } finally { await app.close(); await rm(profile, { recursive: true, force: true }); }
});
