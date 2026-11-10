import { test, expect, _electron as electron, type Page } from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

type Row = { id: string; kind: string; name?: string; import_id?: string; position?: number };
async function rows(page: Page): Promise<Row[]> {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('offerdesk-local-v1', 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const request = db.transaction('records').objectStore('records').getAll();
      request.onsuccess = () => { db.close(); resolve(request.result); };
      request.onerror = () => { db.close(); reject(request.error); };
    };
  }));
}
const launch = (profile: string) => electron.launch({
  ...(process.env.OFFERDESK_TEST_EXECUTABLE ? { executablePath: process.env.OFFERDESK_TEST_EXECUTABLE } : {}),
  args: [...(process.env.OFFERDESK_TEST_EXECUTABLE ? [] : ['desktop']), `--user-data-dir=${profile}`],
});
async function input(page: Page, names: string[]) {
  const buffer = await readFile('desktop/resources/icon.png');
  await page.locator('input[type=file]').setInputFiles(names.map(name => ({ name, mimeType: 'image/png', buffer })));
}

test('替换和删除截图立即清理草稿；写入中断回滚；删除岗位不残留附件', async () => {
  const profile = await mkdtemp(path.join(tmpdir(), 'offerdesk-integrity-'));
  const app = await launch(profile);
  try {
    const page = await app.firstWindow();
    await page.getByRole('button', { name: '上传岗位截图', exact: true }).click();
    await input(page, ['private.png']);
    await page.getByRole('button', { name: '手动填写', exact: true }).click();
    await expect(page.getByLabel(/公司名称/)).toBeVisible();
    const before = (await rows(page)).filter(row => row.kind === 'attachment');
    const importId = before[0].import_id;
    await page.getByRole('button', { name: '返回', exact: true }).click();
    await page.evaluate(() => {
      const original = IDBObjectStore.prototype.put;
      (window as any).__originalPut = original;
      IDBObjectStore.prototype.put = function(value, ...args: any[]) {
        if (value.name === 'replacement.png') throw new DOMException('模拟写入失败', 'QuotaExceededError');
        return original.call(this, value, ...args);
      };
    });
    await input(page, ['replacement.png']);
    await expect(page.getByRole('alert')).toContainText('模拟写入失败');
    expect((await rows(page)).filter(row => row.kind === 'attachment')).toEqual(before);
    await page.evaluate(() => { IDBObjectStore.prototype.put = (window as any).__originalPut; });
    await page.getByRole('button', { name: '移除截图', exact: true }).click();
    await expect(page.locator('.upload-preview')).toHaveCount(0);
    expect((await rows(page)).filter(row => row.kind === 'attachment')).toHaveLength(0);
    await input(page, ['replacement.png']);
    await page.getByRole('button', { name: '手动填写', exact: true }).click();
    await expect(page.getByLabel(/公司名称/)).toBeVisible();
    const after = await rows(page);
    expect(after.filter(row => row.kind === 'import')).toHaveLength(1);
    expect(after.filter(row => row.kind === 'attachment').map(row => row.name)).toEqual(['replacement.png']);
    expect(after.find(row => row.kind === 'attachment')!.import_id).toBe(importId);
    await page.getByLabel(/公司名称/).fill('完整性测试公司');
    await page.getByLabel(/岗位名称/).fill('完整性测试岗位');
    await page.getByRole('button', { name: '保存到岗位列表', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByLabel('搜索公司、岗位或技能').fill('完整性测试岗位');
    await expect(page.locator('.jobs-table tbody tr')).toHaveCount(1);
    await page.locator('.job-title-button:visible, .mobile-job-heading:visible').click();
    // Force a failure after the job deletion is queued, to verify deletion is atomic.
    await page.evaluate(() => {
      const original = IDBObjectStore.prototype.delete;
      (window as any).__originalDelete = original;
      IDBObjectStore.prototype.delete = function(key) {
        if (typeof key === 'string' && !key.startsWith('job-')) throw new Error('模拟删除失败');
        return original.call(this, key);
      };
    });
    await page.getByRole('button', { name: '删除岗位', exact: true }).click();
    await page.getByRole('button', { name: '确认删除', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('模拟删除失败');
    expect((await rows(page)).filter(row => row.kind === 'job' && row.import_id === importId)).toHaveLength(1);
    expect((await rows(page)).filter(row => row.kind === 'attachment')).toHaveLength(1);
    await page.evaluate(() => { IDBObjectStore.prototype.delete = (window as any).__originalDelete; });
    await page.getByRole('button', { name: '确认删除', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect((await rows(page)).filter(row => row.kind === 'attachment' || row.kind === 'import')).toHaveLength(0);
  } finally { await app.close(); await rm(profile, { recursive: true, force: true }); }
});

test('随机附件ID不影响恢复导入、重启后详情中的截图顺序', async () => {
  const profile = await mkdtemp(path.join(tmpdir(), 'offerdesk-order-'));
  let app = await launch(profile);
  try {
    let page = await app.firstWindow();
    await page.getByRole('button', { name: '上传岗位截图', exact: true }).click();
    await input(page, ['first.png', 'second.png', 'third.png']);
    await page.evaluate(() => {
      const original = crypto.randomUUID.bind(crypto);
      const ids = ['00000000-0000-4000-8000-000000000100', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'];
      crypto.randomUUID = () => (ids.shift() as ReturnType<typeof crypto.randomUUID>) || original();
    });
    await page.getByRole('button', { name: '手动填写', exact: true }).click();
    await expect(page.getByLabel(/公司名称/)).toBeVisible();
    await page.getByRole('button', { name: '关闭', exact: true }).click();
    await page.getByRole('button', { name: '继续上次导入', exact: true }).click();
    await page.getByRole('button', { name: '返回', exact: true }).click();
    await expect(page.locator('.source-image figcaption')).toHaveText(['first.png', 'second.png', 'third.png']);
    await page.getByRole('button', { name: '手动填写', exact: true }).click();
    await page.getByLabel(/公司名称/).fill('排序测试公司');
    await page.getByLabel(/岗位名称/).fill('排序测试岗位');
    await page.getByRole('button', { name: '保存到岗位列表', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await app.close(); app = await launch(profile); page = await app.firstWindow();
    await page.getByLabel('搜索公司、岗位或技能').fill('排序测试岗位');
    await expect(page.locator('.jobs-table tbody tr')).toHaveCount(1);
    await page.locator('.job-title-button:visible, .mobile-job-heading:visible').click();
    await page.getByText('原始招聘信息', { exact: false }).click();
    await expect(page.locator('.source-image figcaption')).toHaveText(['first.png', 'second.png', 'third.png']);
  } finally { await app.close(); await rm(profile, { recursive: true, force: true }); }
});
