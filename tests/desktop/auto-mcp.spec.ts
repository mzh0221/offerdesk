import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('本机 MCP 配置先预览再写入，保留其他设置，自检不创建草稿', async () => {
  const profile = await mkdtemp(path.join(tmpdir(), 'offerdesk-auto-ui-'));
  const home = path.join(profile, 'isolated-home');
  const filename = path.join(home, '.workbuddy', 'mcp.json');
  await mkdir(path.dirname(filename), { recursive: true });
  const original = { model: 'keep-model', credentials: 'fixture-only-secret', mcpServers: { other: { command: 'keep-command' } } };
  await writeFile(filename, JSON.stringify(original));
  const app = await electron.launch({
    ...(process.env.OFFERDESK_TEST_EXECUTABLE ? { executablePath: process.env.OFFERDESK_TEST_EXECUTABLE } : {}),
    args: [...(process.env.OFFERDESK_TEST_EXECUTABLE ? [] : ['desktop']), `--user-data-dir=${profile}`],
  });
  try {
    const page = await app.firstWindow();
    await expect(page.getByRole('heading', { name: '让 AI 帮你找机会' })).toBeVisible();
    // Redirect only this isolated test process's home; never write real tool configs.
    await app.evaluate(({ app }, home) => app.setPath('home', home), home);
    await page.getByRole('button', { name: 'AI 采集与导入', exact: true }).click();
    await page.getByRole('group', { name: '选择 AI 工具' }).getByRole('button', { name: 'WorkBuddy', exact: true }).click();
    const panel = page.getByRole('region', { name: '本机自动配置' });
    await panel.getByRole('button', { name: '检测并预览', exact: true }).click();
    await expect(panel.locator('.auto-plan')).toContainText(filename);
    await expect(panel).not.toContainText('fixture-only-secret');
    expect(JSON.parse(await readFile(filename, 'utf8'))).toEqual(original);
    await panel.getByRole('button', { name: '写入配置并检查', exact: true }).click();
    await expect(panel.locator('.auto-result')).toContainText('配置已写入');
    await expect(panel.locator('.success')).toContainText('MCP 服务自检通过');
    const config = JSON.parse(await page.getByLabel('MCP 配置').inputValue());
    const saved = JSON.parse(await readFile(filename, 'utf8'));
    expect(saved.model).toBe(original.model); expect(saved.credentials).toBe(original.credentials);
    expect(saved.mcpServers.other).toEqual(original.mcpServers.other);
    expect(saved.mcpServers.offerdesk).toEqual(config.mcpServers.offerdesk);
    await expect(page.locator('.draft-row')).toHaveCount(0);
    expect(await page.evaluate(() => typeof (window as any).require)).toBe('undefined');
    await page.screenshot({ path: 'test-results/auto-mcp-success.png', animations: 'disabled' });
    await panel.getByRole('button', { name: '重新检测配置', exact: true }).click();
    await writeFile(filename, JSON.stringify({ ...saved, changedByClient: true }));
    await panel.getByRole('button', { name: '写入配置并检查', exact: true }).click();
    await expect(panel.getByRole('alert')).toContainText('发生变化');
    expect(JSON.parse(await readFile(filename, 'utf8')).changedByClient).toBe(true);
    const invalid = await page.evaluate(async () => {
      try { await window.externalImports!.applyAuto('not-a-preview-token'); return false; } catch { return true; }
    });
    expect(invalid).toBe(true);
  } finally {
    await app.close();
    await rm(profile, { recursive: true, force: true, maxRetries: 5 });
  }
});
