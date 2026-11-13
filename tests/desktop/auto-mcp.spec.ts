import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('快速切换工具时忽略旧检测结果，选择工具不会自动写入配置', async () => {
  const profile = await mkdtemp(path.join(tmpdir(), 'offerdesk-connect-switch-'));
  const app = await electron.launch({
    ...(process.env.OFFERDESK_TEST_EXECUTABLE ? { executablePath: process.env.OFFERDESK_TEST_EXECUTABLE } : {}),
    args: [...(process.env.OFFERDESK_TEST_EXECUTABLE ? [] : ['desktop']), `--user-data-dir=${profile}`],
  });
  try {
    const page = await app.firstWindow();
    await expect(page.getByRole('heading', { name: '让 AI 帮你找机会', exact: true })).toBeVisible();
    await app.evaluate(({ ipcMain }) => {
      (globalThis as any).__plans = {};
      (globalThis as any).__writes = 0;
      ipcMain.removeHandler('external-import:auto-prepare');
      ipcMain.removeHandler('external-import:auto-apply');
      ipcMain.handle('external-import:auto-prepare', (_event, id) => new Promise(resolve => { (globalThis as any).__plans[id] = resolve; }));
      ipcMain.handle('external-import:auto-apply', () => { (globalThis as any).__writes++; throw new Error('本测试不应写入'); });
    });
    await page.getByRole('button', { name: 'AI 采集与导入', exact: true }).click();
    await expect.poll(() => app.evaluate(() => !!(globalThis as any).__plans.codex)).toBe(true);
    await page.getByRole('button', { name: 'WorkBuddy', exact: true }).click();
    await expect.poll(() => app.evaluate(() => !!(globalThis as any).__plans.workbuddy)).toBe(true);
    await app.evaluate(() => {
      (globalThis as any).__plans.workbuddy({ token: 'workbuddy-preview', toolId: 'workbuddy', ready: true, configured: false, target: '/fixture/workbuddy/mcp.json', message: '当前工具' });
      (globalThis as any).__plans.codex({ token: 'stale-codex-preview', toolId: 'codex', ready: true, configured: false, target: '/fixture/codex/config.toml', message: '旧工具' });
    });
    await expect(page.locator('.auto-plan')).toContainText('/fixture/workbuddy/mcp.json');
    await expect(page.locator('.auto-plan')).not.toContainText('codex');
    await expect(page.getByRole('button', { name: '连接 WorkBuddy', exact: true })).toBeEnabled();
    expect(await app.evaluate(() => (globalThis as any).__writes)).toBe(0);
    await page.getByRole('button', { name: '已配置，直接验证', exact: true }).click();
    await expect(page.getByRole('region', { name: '验证客户端连接', exact: true })).toBeVisible();
    expect(await app.evaluate(() => (globalThis as any).__writes)).toBe(0);
  } finally { await app.close(); await rm(profile, { recursive: true, force: true, maxRetries: 5 }); }
});

test('本机 MCP 配置只写入不自检，故障排查需手动展开且不创建草稿', async () => {
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
    await app.evaluate(({ app }, home) => {
      app.setPath('home', home);
      const automatic = process.getBuiltinModule('module').createRequire(app.getAppPath() + '/main.cjs')('./auto-mcp.cjs');
      const check = automatic.checkService;
      (globalThis as any).__healthChecks = 0;
      automatic.checkService = (...args: any[]) => { (globalThis as any).__healthChecks++; return check(...args); };
    }, home);
    await page.getByRole('button', { name: 'AI 采集与导入', exact: true }).click();
    await page.getByRole('group', { name: '选择 AI 工具' }).getByRole('button', { name: 'WorkBuddy', exact: true }).click();
    const panel = page.getByRole('region', { name: '本机自动配置' });
    await expect(panel.locator('.auto-plan')).toContainText(filename);
    await expect(panel).not.toContainText('fixture-only-secret');
    expect(JSON.parse(await readFile(filename, 'utf8'))).toEqual(original);
    await panel.getByRole('button', { name: '连接 WorkBuddy', exact: true }).click();
    await expect(page.getByRole('region', { name: '验证客户端连接', exact: true })).toBeVisible();
    await expect(page.locator('.auto-result')).toContainText('配置已写入');
    await expect(page.getByLabel('OfferDesk 本机服务状态', { exact: true })).toHaveCount(0);
    expect(await app.evaluate(() => (globalThis as any).__healthChecks)).toBe(0);
    await page.getByRole('button', { name: '复制验证提示词', exact: true }).click();
    const verification = await app.evaluate(({ clipboard }) => clipboard.readText());
    expect(verification).toContain('get_import_spec');
    expect(verification).toContain('不要搜索岗位');
    await expect(page.getByLabel('操作反馈', { exact: true })).toContainText('验证提示词已复制');
    await page.getByRole('button', { name: '我已验证，下一步', exact: true }).click();
    await expect(page.getByRole('region', { name: '采集任务', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '复制采集任务', exact: true }).click();
    expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toContain('availability');
    await page.getByRole('region', { name: '采集任务', exact: true }).screenshot({ path: test.info().outputPath('collect-step.png'), animations: 'disabled' });
    const config = JSON.parse(await page.getByLabel('MCP 配置').inputValue());
    const saved = JSON.parse(await readFile(filename, 'utf8'));
    expect(saved.model).toBe(original.model); expect(saved.credentials).toBe(original.credentials);
    expect(saved.mcpServers.other).toEqual(original.mcpServers.other);
    expect(saved.mcpServers.offerdesk).toEqual(config.mcpServers.offerdesk);
    await expect(page.locator('.draft-row')).toHaveCount(0);
    expect(await page.evaluate(() => typeof (window as any).require)).toBe('undefined');
    const diagnostics = page.locator('.connection-troubleshooting');
    await expect(diagnostics).toHaveJSProperty('open', false);
    await expect(page.getByRole('button', { name: '自检 OfferDesk 服务', exact: true })).toHaveCount(0);
    await diagnostics.locator('summary').click();
    await diagnostics.getByRole('button', { name: '自检 OfferDesk 服务', exact: true }).click();
    await expect(diagnostics.locator('.mcp-status--success')).toContainText('OfferDesk 服务自检通过');
    expect(await app.evaluate(() => (globalThis as any).__healthChecks)).toBe(1);
    await diagnostics.screenshot({ path: test.info().outputPath('manual-service-check.png'), animations: 'disabled' });
    await diagnostics.locator('summary').click();
    await page.getByRole('button', { name: '返回验证', exact: true }).click();
    await page.getByRole('region', { name: '验证客户端连接', exact: true }).screenshot({ path: test.info().outputPath('verify-step.png'), animations: 'disabled' });
    await page.getByRole('button', { name: '返回配置', exact: true }).click();
    await expect(panel.locator('.auto-plan')).toContainText('已有 OfferDesk 配置');
    await panel.screenshot({ path: test.info().outputPath('connect-step.png'), animations: 'disabled' });
    await writeFile(filename, JSON.stringify(original));
    await panel.getByRole('button', { name: '重新检测', exact: true }).click();
    await expect(panel.locator('.auto-plan')).toContainText('可以自动配置');
    await writeFile(filename, JSON.stringify({ ...saved, changedByClient: true }));
    await panel.getByRole('button', { name: '连接 WorkBuddy', exact: true }).click();
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

test('未找到 ZCode 配置时仍显示连接未验证；OfferDesk 自检单独显示通过、失败和重试结果', async () => {
  const profile = await mkdtemp(path.join(tmpdir(), 'offerdesk-mcp-status-'));
  const app = await electron.launch({
    ...(process.env.OFFERDESK_TEST_EXECUTABLE ? { executablePath: process.env.OFFERDESK_TEST_EXECUTABLE } : {}),
    args: [...(process.env.OFFERDESK_TEST_EXECUTABLE ? [] : ['desktop']), `--user-data-dir=${profile}`],
  });
  try {
    const page = await app.firstWindow();
    // Simulate health-check outcomes only in this isolated process. Keep the real
    // service probe covered by the configuration test above.
    await app.evaluate(({ app, ipcMain }, home) => {
      app.setPath('home', home);
      ipcMain.removeHandler('external-import:service-check');
      (globalThis as any).__healthOutcome = 'success';
      ipcMain.handle('external-import:service-check', () => {
        if ((globalThis as any).__healthOutcome === 'pending') return new Promise(resolve => { (globalThis as any).__finishHealth = resolve; });
        if ((globalThis as any).__healthOutcome === 'error') throw new Error('模拟自检异常');
        return true;
      });
    }, profile);
    await page.getByRole('button', { name: 'AI 采集与导入', exact: true }).click();
    await page.getByRole('group', { name: '选择 AI 工具' }).getByRole('button', { name: 'ZCode', exact: true }).click();
    const panel = page.getByRole('region', { name: '本机自动配置' });
    await expect(panel.locator('.connect-fallback')).toContainText('未发现 ZCode');
    await expect(panel.getByRole('button', { name: '连接 ZCode', exact: true })).toHaveCount(0);
    await panel.getByRole('button', { name: '复制 MCP 配置', exact: true }).click();
    await expect(page.locator('.manual-setup')).toHaveJSProperty('open', true);
    expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toContain('features');
    await expect(panel.getByRole('button', { name: '自检 OfferDesk 服务', exact: true })).toHaveCount(0);
    const diagnostics = page.locator('.connection-troubleshooting');
    const check = diagnostics.getByRole('button', { name: '自检 OfferDesk 服务', exact: true });
    await expect(check).toHaveCount(0);
    await diagnostics.locator('summary').click();
    await expect(page.getByLabel('OfferDesk 本机服务状态', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('region', { name: '验证客户端连接', exact: true })).toHaveCount(0);
    await check.click();
    const passed = diagnostics.locator('.mcp-status--success');
    await expect(passed).toContainText('OfferDesk 服务自检通过');
    await expect(passed).toContainText('未检查 ZCode 是否打开或已连接');
    await expect(panel.getByRole('heading', { name: '连接 ZCode', exact: true })).toBeVisible();
    await expect(passed).toHaveAttribute('role', 'status');
    await diagnostics.locator('summary').click();
    await expect(passed).not.toBeVisible();
    await diagnostics.locator('summary').click();
    await passed.screenshot({ path: test.info().outputPath('mcp-passed.png'), animations: 'disabled' });

    await app.evaluate(() => { (globalThis as any).__healthOutcome = 'pending'; });
    await check.click();
    await expect(diagnostics.locator('.mcp-status--checking')).toContainText('正在自检 OfferDesk 服务');
    await expect(passed).toHaveCount(0);
    await expect(check).toBeDisabled();
    await app.evaluate(() => { (globalThis as any).__finishHealth(false); });
    const failed = diagnostics.getByRole('alert');
    await expect(failed).toContainText('OfferDesk 服务自检未通过');
    await expect(failed).toContainText('核对应用路径与启动参数');
    await expect(failed.locator('svg')).toHaveCount(1);
    await failed.screenshot({ path: test.info().outputPath('mcp-failed.png'), animations: 'disabled' });

    await app.evaluate(() => { (globalThis as any).__healthOutcome = 'error'; });
    await check.click();
    await expect(failed).toContainText('无法完成 OfferDesk 服务自检');
    await expect(passed).toHaveCount(0);
    await page.setViewportSize({ width: 800, height: 600 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await failed.scrollIntoViewIfNeeded();
    await expect(failed).toBeInViewport();
    expect(await failed.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await failed.screenshot({ path: test.info().outputPath('mcp-failed-small.png'), animations: 'disabled' });

    await app.evaluate(() => { (globalThis as any).__healthOutcome = 'success'; });
    await check.click();
    await expect(passed).toContainText('OfferDesk 服务自检通过');
    await expect(panel.getByRole('heading', { name: '连接 ZCode', exact: true })).toBeVisible();
    await expect(failed).toHaveCount(0);
    await page.getByRole('group', { name: '选择 AI 工具' }).getByRole('button', { name: 'Claude', exact: true }).click();
    await expect(page.getByLabel('OfferDesk 本机服务状态', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('region', { name: '验证客户端连接', exact: true })).toHaveCount(0);
    await expect(panel.getByRole('heading', { name: '连接 Claude Desktop', exact: true })).toBeVisible();
  } finally {
    await app.close();
    await rm(profile, { recursive: true, force: true, maxRetries: 5 });
  }
});
