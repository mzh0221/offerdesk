import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('安装包界面离线运行，岗位、投递记录和截图在完整重启后保留', async () => {
  const profile = await mkdtemp(path.join(tmpdir(), 'offerdesk-test-'));
  let application: ElectronApplication | undefined;
  const launch = async (legacy = false) => {
    application = await electron.launch({
      ...(!legacy && process.env.OFFERDESK_TEST_EXECUTABLE ? { executablePath: process.env.OFFERDESK_TEST_EXECUTABLE } : {}),
      args: [...(legacy ? [process.env.OFFERDESK_UPGRADE_FROM!] : process.env.OFFERDESK_TEST_EXECUTABLE ? [] : ['desktop']), `--user-data-dir=${profile}`],
      env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' },
    });
    const page = await application.firstWindow();
    await expect(page.getByRole('heading', { name: '岗位与投递', exact: true })).toBeVisible();
    return page;
  };
  try {
    let page = await launch(Boolean(process.env.OFFERDESK_UPGRADE_FROM));
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    expect(page.url()).toBe('offerdesk://app/');
    await expect(page.locator('.jobs-table tbody tr')).toHaveCount(0);
    expect(await page.evaluate(() => typeof (globalThis as Record<string, unknown>).require)).toBe('undefined');
    expect(await page.evaluate(async () => { try { await fetch('https://example.com'); return false; } catch { return true; } })).toBe(true);

    await page.locator('button.screenshot-action').click();
    await page.locator('input[type="file"]').setInputFiles({
      name: 'local-test.png',
      mimeType: 'image/png',
      buffer: await readFile('desktop/resources/icon.png'),
    });
    await page.getByRole('button', { name: '手动填写', exact: true }).click();
    await expect(page.getByLabel(/公司名称/)).toBeVisible();
    await page.getByLabel(/公司名称/).fill('桌面测试公司');
    await page.getByLabel(/岗位名称/).fill('桌面持久化测试岗位');
    await page.getByRole('button', { name: '保存到岗位列表', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByLabel('搜索公司、岗位或技能').fill('桌面持久化测试岗位');
    await expect(page.locator('.jobs-table tbody tr')).toHaveCount(1);
    await page.locator('.jobs-table .job-title-button').click();
    await page.getByLabel('当前状态').selectOption('已投递');
    await page.getByLabel('个人备注').fill('重启后应保留的备注');
    await page.getByRole('button', { name: '保存修改', exact: true }).click();
    await expect(page.getByText('修改已保存', { exact: true })).toBeVisible();
    await page.getByText('原始招聘信息', { exact: false }).click();
    const image = page.getByRole('img', { name: 'local-test.png', exact: true });
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await expect(image).toHaveAttribute('src', /^blob:offerdesk:\/\/app\//);
    const opened = application!.waitForEvent('window');
    await image.click();
    const original = await opened;
    await expect.poll(() => original.url()).toMatch(/^offerdesk:\/\/app\/image.html#/);
    await expect.poll(() => original.getByRole('img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await original.close();
    await application!.close();
    application = undefined;

    page = await launch();
    page.on('pageerror', error => errors.push(error.message));
    await page.getByLabel('搜索公司、岗位或技能').fill('桌面持久化测试岗位');
    await expect(page.locator('.jobs-table tbody tr')).toHaveCount(1);
    await page.locator('.jobs-table .job-title-button').click();
    await expect(page.getByLabel('当前状态')).toHaveValue('已投递');
    await expect(page.getByLabel('个人备注')).toHaveValue('重启后应保留的备注');
    await expect(page.getByLabel('投递日期')).not.toHaveValue('');
    await page.getByText('原始招聘信息', { exact: false }).click();
    await expect.poll(() => page.getByRole('img', { name: 'local-test.png', exact: true }).evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await page.getByRole('button', { name: '删除岗位', exact: true }).click();
    await page.getByRole('button', { name: '确认删除', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.jobs-table tbody tr')).toHaveCount(0);
    expect(await page.evaluate(() => new Promise<number>((resolve, reject) => {
      const open = indexedDB.open('offerdesk-local-v1', 1);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const rows = db.transaction('records', 'readonly').objectStore('records').getAll();
        rows.onerror = () => { db.close(); reject(rows.error); };
        rows.onsuccess = () => { const remaining = rows.result.filter(row => row.kind === 'attachment' || row.kind === 'import').length; db.close(); resolve(remaining); };
      };
    }))).toBe(0);
    await page.getByLabel('搜索公司、岗位或技能').fill('');
    await expect(page.locator('.jobs-table tbody tr')).toHaveCount(0);
    await page.screenshot({ path: 'test-results/desktop-home.png', fullPage: true });
    expect(errors).toEqual([]);
  } finally {
    await application?.close();
    await rm(profile, { recursive: true, force: true });
  }
});
