import { test, expect, _electron as electron, type Page } from '@playwright/test';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { addLegacyTextDraft } from './legacy-draft';

async function launch(profile: string) {
  return electron.launch({
    ...(process.env.OFFERDESK_TEST_EXECUTABLE ? { executablePath: process.env.OFFERDESK_TEST_EXECUTABLE } : {}),
    args: [...(process.env.OFFERDESK_TEST_EXECUTABLE ? [] : ['desktop']), `--user-data-dir=${profile}`],
  });
}
async function closeCapture(page: Page) {
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  const keep = page.getByRole('button', { name: '保存草稿并关闭', exact: true });
  if (await keep.isVisible()) await keep.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test('正常与减少动态效果模式下，AI 工具切换、键盘操作和小窗口保持可用', async () => {
  const profile = await mkdtemp(path.join(tmpdir(), 'offerdesk-motion-'));
  const app = await launch(profile);
  try {
    const page = await app.firstWindow();
    for (const reducedMotion of ['no-preference', 'reduce'] as const) {
      await page.emulateMedia({ reducedMotion });
      if (reducedMotion === 'reduce') await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(760, 560));
      const entry = page.getByRole('button', { name: 'AI 采集与导入', exact: true });
      await entry.click();
      const picker = page.getByRole('group', { name: '选择 AI 工具' });
      await picker.getByRole('button', { name: 'Claude', exact: true }).focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('region', { name: 'Claude 接入配置' })).toBeVisible();
      await picker.getByRole('button', { name: 'DSH', exact: true }).focus();
      await page.keyboard.press('Space');
      await expect(page.getByLabel('Cordis 补丁')).toContainText('@deepseek-ai/dsh-mcp-client');
      await picker.getByRole('button', { name: 'OpenCode', exact: true }).click();
      await expect(page.getByRole('region', { name: 'OpenCode 接入配置' })).toBeVisible();
      await expect(picker.locator('[aria-pressed=true]')).toHaveCount(1);
      await expect(page.locator('.connect-stage .connect-actions .primary')).toBeInViewport();
      await page.getByRole('button', { name: '已配置，直接验证', exact: true }).click();
      await expect(page.getByRole('region', { name: '验证客户端连接', exact: true })).toBeVisible();
      await page.getByRole('button', { name: '复制验证提示词', exact: true }).scrollIntoViewIfNeeded();
      await expect(page.getByRole('button', { name: '复制验证提示词', exact: true })).toBeInViewport();
      expect(await page.getByRole('dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      if (reducedMotion === 'reduce') {
        expect(await page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running' || animation.pending).length)).toBe(0);
        await page.screenshot({ path: 'test-results/motion-reduced-small.png', animations: 'disabled' });
      }
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(entry).toBeFocused();
    }
  } finally {
    await app.close();
    await rm(profile, { recursive: true, force: true, maxRetries: 5 });
  }
});

test('原文、人工核对和手动草稿重启恢复；多草稿可选择和丢弃', async () => {
  const profile = await mkdtemp(path.join(tmpdir(), 'offerdesk-ux-drafts-'));
  let app = await launch(profile);
  try {
    let page = await app.firstWindow();
    await expect(page.getByRole('button', { name: '文字录入', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '粘贴招聘文字', exact: true })).toHaveCount(0);
    await addLegacyTextDraft(page, '公司：草稿科技\n岗位：前端工程师\n城市：杭州');
    await page.getByRole('button', { name: '继续上次导入', exact: true }).click();
    await closeCapture(page);
    await page.getByRole('button', { name: '继续上次导入', exact: true }).click();
    await expect(page.locator('.review-source pre')).toContainText('草稿科技');
    await expect(page.getByRole('button', { name: '返回', exact: true })).toHaveCount(0);
    await page.getByLabel(/公司名称/).fill('人工修正科技');
    await page.getByLabel('招聘链接（选填）').fill('https://example.com/job');
    await expect(page.getByText('草稿已保存 · 数据保存在本机', { exact: true })).toBeVisible();
    await page.getByLabel(/公司名称/).focus();
    await page.screenshot({ path: 'test-results/ux-review-wide.png', animations: 'disabled' });
    await closeCapture(page);
    await page.getByRole('button', { name: '手动录入', exact: true }).click();
    await page.getByLabel(/公司名称/).fill('手动公司');
    await page.getByLabel(/岗位名称/).fill('手动岗位');
    await closeCapture(page);
    await app.close(); app = await launch(profile); page = await app.firstWindow();
    await page.locator('.draft-list summary').click();
    await expect(page.locator('.draft-row')).toHaveCount(2);
    await page.locator('.draft-row').filter({ hasText: '前端工程师' }).getByRole('button', { name: '继续编辑' }).click();
    await expect(page.getByLabel(/公司名称/)).toHaveValue('人工修正科技');
    await expect(page.getByLabel('招聘链接（选填）')).toHaveValue('https://example.com/job');
    await page.getByRole('button', { name: '保存到岗位列表', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.locator('.draft-list').evaluate((el: HTMLDetailsElement) => { el.open = true; });
    page.once('dialog', dialog => void dialog.accept());
    await page.getByRole('button', { name: '丢弃草稿', exact: true }).click();
    await expect(page.locator('.draft-list')).toHaveCount(0);
    await expect(page.locator('.jobs-table tbody tr')).toHaveCount(1);
  } finally {
    await Promise.all([app.waitForEvent('close'), app.evaluate(({ app }) => app.exit(0)).catch(() => {})]);
    await rm(profile, { recursive: true, force: true, maxRetries: 5 });
  }
});

test('保存失败保留输入，详情关闭保护与最小窗口操作', async () => {
  const profile = await mkdtemp(path.join(tmpdir(), 'offerdesk-ux-edit-'));
  const app = await launch(profile);
  try {
    const page = await app.firstWindow();
    await page.getByRole('button', { name: '手动录入', exact: true }).click();
    await page.evaluate(() => {
      const original = IDBObjectStore.prototype.put;
      (window as any).__put = original;
      IDBObjectStore.prototype.put = function () { throw new Error('模拟磁盘写入失败'); };
    });
    await page.getByLabel(/公司名称/).fill('保护测试公司');
    await page.getByLabel(/岗位名称/).fill('保护测试岗位');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '保存草稿并关闭' }).click();
    await expect(page.getByRole('alert')).toContainText('模拟磁盘写入失败');
    await expect(page.getByLabel(/公司名称/)).toHaveValue('保护测试公司');
    await page.evaluate(() => { IDBObjectStore.prototype.put = (window as any).__put; });
    await page.getByRole('button', { name: '继续编辑', exact: true }).click();
    await page.getByRole('button', { name: '保存到岗位列表', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.locator('.job-title-button:visible, .mobile-job-heading:visible').click();
    await expect(page.getByRole('button', { name: '保存修改', exact: true })).toBeDisabled();
    await page.getByLabel('个人备注').fill('明天下午面试');
    await app.evaluate(({ dialog, BrowserWindow }) => {
      (globalThis as any).__unloadPrompts = 0;
      dialog.showMessageBoxSync = (() => { (globalThis as any).__unloadPrompts++; return 0; }) as typeof dialog.showMessageBoxSync;
      BrowserWindow.getAllWindows()[0].webContents.reload();
    });
    await expect.poll(() => app.evaluate(() => (globalThis as any).__unloadPrompts)).toBe(1);
    await expect(page.getByLabel('个人备注')).toHaveValue('明天下午面试');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('alertdialog', { name: '未保存修改' })).toBeVisible();
    await page.getByRole('button', { name: '继续编辑', exact: true }).click();
    await expect(page.getByLabel('个人备注')).toHaveValue('明天下午面试');
    await page.getByRole('button', { name: '关闭', exact: true }).click();
    await page.getByRole('button', { name: '保存并关闭', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.locator('.job-title-button:visible, .mobile-job-heading:visible').click();
    await expect(page.getByLabel('个人备注')).toHaveValue('明天下午面试');
    await page.getByLabel('当前状态').selectOption('面试');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '放弃修改', exact: true }).click();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(760, 560));
    await expect(page.locator('.mobile-jobs')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('.mobile-jobs select').selectOption('已投递');
    await expect(page.getByRole('status')).toContainText('投递状态已更新');
    await page.locator('.mobile-job-heading').click();
    await expect(page.getByLabel('当前状态')).toHaveValue('已投递');
    await page.screenshot({ path: 'test-results/ux-detail-small.png', animations: 'disabled' });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '手动录入', exact: true }).click();
    await page.getByLabel(/公司名称/).fill('小窗口公司');
    await page.getByLabel(/岗位名称/).fill('小窗口岗位');
    const save = page.getByRole('button', { name: '保存到岗位列表', exact: true });
    await expect(save).toBeInViewport();
    await page.screenshot({ path: 'test-results/ux-form-small.png', animations: 'disabled' });
    await save.click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  } finally {
    await Promise.all([app.waitForEvent('close'), app.evaluate(({ app }) => app.exit(0)).catch(() => {})]);
    await rm(profile, { recursive: true, force: true, maxRetries: 5 });
  }
});

test('恢复截图可移除、排序和补充；丢弃只删除关联草稿', async () => {
  const profile = await mkdtemp(path.join(tmpdir(), 'offerdesk-ux-images-'));
  const app = await launch(profile);
  try {
    const page = await app.firstWindow();
    const buffer = await readFile('desktop/resources/icon.png');
    await page.locator('.screenshot-action').click();
    await expect(page.getByRole('button', { name: '粘贴文字', exact: true })).toHaveCount(0);
    await page.locator('input[type=file]').setInputFiles(['first.png', 'second.png'].map(name => ({ name, mimeType: 'image/png', buffer })));
    await page.getByRole('button', { name: '手动填写', exact: true }).click();
    await closeCapture(page);
    await page.getByRole('button', { name: '继续上次导入' }).click();
    await page.getByRole('button', { name: '返回', exact: true }).click();
    await page.getByRole('button', { name: '前移截图', exact: true }).nth(1).click();
    await expect(page.locator('.upload-preview > div > span')).toHaveText(['1. second.png', '2. first.png']);
    await page.getByRole('button', { name: '移除截图', exact: true }).nth(1).click();
    await expect(page.locator('.upload-preview')).toHaveCount(1);
    await expect(page.locator('input[type=file]')).toBeEnabled();
    await page.locator('input[type=file]').setInputFiles({ name: 'third.png', mimeType: 'image/png', buffer });
    await expect(page.locator('.upload-preview > div > span')).toHaveText(['1. second.png', '2. third.png']);
    await closeCapture(page);
    await page.locator('.draft-list').evaluate((el: HTMLDetailsElement) => { el.open = true; });
    page.once('dialog', dialog => void dialog.accept());
    await page.getByRole('button', { name: '丢弃草稿', exact: true }).click();
    await expect(page.locator('.draft-list')).toHaveCount(0);
    const count = await page.evaluate(() => new Promise<number>(resolve => { const r = indexedDB.open('offerdesk-local-v1', 1); r.onsuccess = () => { const db = r.result; const q = db.transaction('records').objectStore('records').getAll(); q.onsuccess = () => { resolve(q.result.length); db.close(); }; }; }));
    expect(count).toBe(0);
    // A draft from the old format has no step, source_url or additional_text.
    await page.evaluate(() => new Promise<void>(resolve => {
      const r = indexedDB.open('offerdesk-local-v1', 1);
      r.onsuccess = () => {
        const db = r.result; const tx = db.transaction('records', 'readwrite');
        tx.objectStore('records').put({ id: crypto.randomUUID(), kind: 'import', state: 'uploaded', input_type: 'text', raw_text: '旧版未完成原文', extracted: null, created_at: '2026-01-01T00:00:00Z' });
        tx.oncomplete = () => { db.close(); resolve(); };
      };
    }));
    await page.reload();
    await page.getByRole('button', { name: '继续上次导入', exact: true }).click();
    await expect(page.locator('.review-source pre')).toHaveText('旧版未完成原文');
    await expect(page.getByLabel('招聘原文', { exact: true })).toHaveCount(0);
    await closeCapture(page);
  } finally {
    await Promise.all([app.waitForEvent('close'), app.evaluate(({ app }) => app.exit(0)).catch(() => {})]);
    await rm(profile, { recursive: true, force: true, maxRetries: 5 });
  }
});
