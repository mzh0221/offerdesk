import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

function mcp(profile: string, launchConfig?: { command: string; args: string[] }) {
  const executable = process.env.OFFERDESK_TEST_EXECUTABLE || String(require('electron'));
  const child: ChildProcessWithoutNullStreams = spawn(launchConfig?.command || executable, launchConfig?.args || [...(process.env.OFFERDESK_TEST_EXECUTABLE ? [] : ['desktop']), '--offerdesk-mcp', `--user-data-dir=${profile}`]);
  const pending = new Map<number, (value: any) => void>(); let sequence = 0;
  createInterface({ input: child.stdout }).on('line', line => { try { const value = JSON.parse(line); pending.get(value.id)?.(value); pending.delete(value.id); } catch {} });
  child.stderr.on('data', () => {});
  return { child, call(method: string, params = {}) { const id = ++sequence; return new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('MCP timeout')); }, 10000);
    pending.set(id, value => { clearTimeout(timer); resolve(value); }); child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  }); } };
}
async function stopMcp(child: ChildProcessWithoutNullStreams) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise(resolve => child.once('exit', resolve));
  child.kill(); await exited;
}
const launch = (profile: string) => electron.launch({
  ...(process.env.OFFERDESK_TEST_EXECUTABLE ? { executablePath: process.env.OFFERDESK_TEST_EXECUTABLE } : {}),
  args: [...(process.env.OFFERDESK_TEST_EXECUTABLE ? [] : ['desktop']), `--user-data-dir=${profile}`],
});
const job = { source: '测试企业官网', source_url: 'https://example.com/jobs?id=123&utm_source=agent', raw_text: '测试公司招聘前端实习生，杭州。\n## 任职要求\n1. 本科及以上在读，2027届\n2. 熟悉 TypeScript 和 React\n## 加分项\n有开源经验优先\n## 到岗要求\n每周至少4天，实习至少3个月\n两周内到岗', fields: { company: 'MCP测试公司', title: 'MCP前端实习生', city: '杭州' } };
const result = (value: any) => JSON.parse(value.result.content[0].text);
test('MCP采集导入、校验、并发去重、重试、核对保存与重启', async () => {
  const profile = await mkdtemp(path.join(tmpdir(), 'offerdesk-mcp-test-'));
  const client = mcp(profile); let app: Awaited<ReturnType<typeof launch>> | undefined;
  try {
    expect((await client.call('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1' } })).result.capabilities.tools).toEqual({});
    expect((await client.call('tools/list')).result.tools.map((tool: any) => tool.name)).toEqual(['get_import_spec', 'import_jobs']);
    expect(result(await client.call('tools/call', { name: 'get_import_spec' })).example.jobs).toHaveLength(1);
    expect((await client.call('tools/call', { name: 'import_jobs', arguments: { batch_id: 'before-open', jobs: [job] } })).result.isError).toBe(true);
    app = await launch(profile); let page = await app.firstWindow();
    await expect(page.getByRole('heading', { name: '让 AI 帮你找机会', exact: true })).toBeVisible();
    const call = (args: unknown) => client.call('tools/call', { name: 'import_jobs', arguments: args });
    const args = { batch_id: 'batch-1', jobs: [job, { ...job, raw_text: '' }, { ...job, source_url: 'https://example.com/jobs?id=123#top' }] };
    // The heading can render before the main process receives the import-ready handshake.
    let firstResponse: any;
    await expect.poll(async () => { firstResponse = await call(args); return firstResponse.result.isError ?? false; }).toBe(false);
    const first = result(firstResponse);
    expect(first.results.map((r: any) => r.status)).toEqual(['created', 'invalid', 'duplicate']);
    expect(first.results[0].filled_fields).toEqual(expect.arrayContaining(['required', 'preferred', 'availability', 'education', 'days_per_week']));
    expect(first.results[0].warnings).toBeUndefined();
    expect(result(await call(args))).toEqual(first);
    expect((await call({ ...args, jobs: [job] })).result.isError).toBe(true);
    const concurrent = await Promise.all([call({ batch_id: 'parallel-1', jobs: [job] }), call({ batch_id: 'parallel-2', jobs: [job] })]);
    expect(concurrent.map(r => result(r).results[0].status)).toEqual(['duplicate', 'duplicate']);
    expect((await call({ batch_id: 'oversize', jobs: Array(51).fill(job) })).result.isError).toBe(true);
    // A receipt failure must roll back the draft in the same transaction.
    await page.evaluate(() => {
      const original = IDBObjectStore.prototype.put;
      (window as any).__originalPut = original;
      IDBObjectStore.prototype.put = function(value, ...args: any[]) {
        if (value.kind === 'external-batch') throw new Error('模拟外部导入失败');
        return original.call(this, value, ...args);
      };
    });
    const retry = { batch_id: 'rollback', jobs: [{ ...job, source_url: 'https://example.com/jobs?id=rollback', fields: { company: '回滚公司', title: '回滚岗位' } }] };
    expect((await call(retry)).result.isError).toBe(true);
    await page.evaluate(() => { IDBObjectStore.prototype.put = (window as any).__originalPut; });
    expect(result(await call(retry)).results[0].status).toBe('created');
    // Discard this second draft; replaying its batch must not recreate it.
    page.once('dialog', dialog => dialog.accept());
    await page.locator('.draft-row').filter({ hasText: '回滚岗位' }).getByRole('button', { name: '丢弃草稿' }).click();
    expect(result(await call(retry)).results[0].status).toBe('created');
    const descriptor = JSON.parse(await readFile(path.join(profile, 'mcp-connection.json'), 'utf8'));
    const unauthorized = await new Promise<string>((resolve, reject) => {
      const socket = net.createConnection(descriptor.socket); let text = ''; socket.setEncoding('utf8');
      socket.on('connect', () => socket.write(JSON.stringify({ token: 'bad', body: args }) + '\n'));
      socket.on('data', chunk => text += chunk); socket.on('end', () => resolve(text)); socket.on('error', reject);
    });
    expect(JSON.parse(unauthorized).error).toBe('未授权连接');
    await expect(page.getByText('外部导入待核对 · 1 条')).toBeVisible();
    await expect(page.locator('.jobs-table tbody tr')).toHaveCount(0);
    await app.close(); app = await launch(profile); page = await app.firstWindow();
    await expect(page.getByText('外部导入待核对 · 1 条')).toBeVisible();
    expect(result(await call(args))).toEqual(first);
    await page.getByRole('button', { name: '核对岗位', exact: true }).click();
    await expect(page.getByLabel(/公司名称/)).toHaveValue('MCP测试公司');
    await expect(page.getByLabel(/岗位名称/)).toHaveValue('MCP前端实习生');
    await expect(page.getByLabel('必备技能', { exact: true })).toHaveValue('本科及以上在读,2027届\n熟悉 TypeScript 和 React');
    await expect(page.getByLabel('加分项', { exact: true })).toHaveValue('有开源经验优先');
    await expect(page.getByLabel('到岗条件', { exact: true })).toHaveValue('每周至少4天,实习至少3个月\n两周内到岗');
    await expect(page.getByLabel('每周到岗', { exact: true })).toHaveValue('每周至少4天');
    await page.getByRole('button', { name: '从原文补全', exact: true }).click();
    await expect(page.getByLabel('必备技能', { exact: true })).toHaveValue('本科及以上在读,2027届\n熟悉 TypeScript 和 React');
    await page.getByRole('button', { name: '保存到岗位列表', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.jobs-table tbody tr')).toHaveCount(1);
    expect(result(await call({ batch_id: 'after-save', jobs: [job] })).results[0].status).toBe('duplicate');
    await app.close(); app = await launch(profile); page = await app.firstWindow();
    await page.locator('.job-title-button:visible, .mobile-job-heading:visible').click();
    await expect(page.locator('.requirement-list').filter({ hasText: '必备技能' }).locator('li')).toHaveText(['本科及以上在读,2027届', '熟悉 TypeScript 和 React']);
    await expect(page.locator('.requirement-list').filter({ hasText: '加分项' }).locator('li')).toHaveText(['有开源经验优先']);
    await expect(page.locator('.requirement-list').filter({ hasText: '到岗条件' }).locator('li')).toHaveText(['每周至少4天,实习至少3个月', '两周内到岗']);
    await app.close(); app = undefined;
    expect((await call({ batch_id: 'closed', jobs: [job] })).result.isError).toBe(true);
  } finally { await stopMcp(client.child); if (app) await app.close(); await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
});

test('MCP 配置指南与受限复制可用，文件导入入口已移除', async () => {
  const profile = await mkdtemp(path.join(tmpdir(), 'offerdesk-harness-test-'));
  const app = await launch(profile);
  try {
    const page = await app.firstWindow();
    await expect(page.getByRole('button', { name: '使用说明', exact: true })).toHaveCount(1);
    await expect(page.getByRole('button', { name: '说明', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: '开始 AI 导入', exact: true }).click();
    await page.getByText('手动配置与参数', { exact: true }).click();
    await expect(page.getByLabel('MCP 配置')).toContainText('--offerdesk-mcp');
    const codexConfig = await page.getByLabel('MCP 配置').inputValue();
    const expectedCommand = JSON.parse(codexConfig.split('\n')[1].slice('command = '.length));
    const expectedArgs = JSON.parse(codexConfig.split('\n')[2].slice('args = '.length));
    await expect(page.getByLabel('MCP 启动命令')).toHaveValue(expectedCommand);
    for (const [index, arg] of expectedArgs.entries()) await expect(page.getByLabel(`MCP 参数 ${index + 1}`, { exact: true })).toHaveValue(arg);
    await page.locator('.connection-form').screenshot({ path: test.info().outputPath('mcp-form.png'), animations: 'disabled' });
    await page.getByRole('button', { name: '复制启动命令', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('status')).toContainText('启动命令已复制');
    expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toBe(expectedCommand);
    await page.getByRole('button', { name: '复制参数 1', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('status')).toContainText('参数 1 已复制');
    expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toBe(expectedArgs[0]);
    const rejected = await page.evaluate(async () => { try { await window.externalImports!.copyText('未展示的任意文本'); return false; } catch { return true; } });
    expect(rejected).toBe(true);
    expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toBe(expectedArgs[0]);
    await page.getByRole('button', { name: '已配置，直接验证', exact: true }).click();
    await expect(page.getByLabel('连接检查提示词')).toContainText('不要搜索岗位');
    const picker = page.getByRole('group', { name: '选择 AI 工具' });
    await expect(picker.getByRole('button')).toHaveCount(6);
    await expect(picker.getByRole('button', { name: '豆包工作', exact: true })).toHaveCount(0);
    await expect(page.getByRole('dialog').locator('input[type=file]')).toHaveCount(0);
    await expect(picker.getByRole('button', { name: 'Codex', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await picker.getByRole('button', { name: 'Claude', exact: true }).click();
    await expect(picker.getByRole('button', { name: 'Claude', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(picker.getByRole('button', { name: 'Codex', exact: true })).toHaveAttribute('aria-pressed', 'false');
    const config = JSON.parse(await page.getByLabel('MCP 配置').inputValue());
    expect(config.mcpServers.offerdesk.command).toBeTruthy();
    expect(config.mcpServers.offerdesk.args).toContain('--offerdesk-mcp');
    await page.screenshot({ path: test.info().outputPath('ai-import.png'), animations: 'disabled' });
    const executable = process.env.OFFERDESK_TEST_EXECUTABLE || String(require('electron'));
    const removed = await new Promise<{ code: number | null; error: string }>((resolve, reject) => {
      const child = spawn(executable, [...(process.env.OFFERDESK_TEST_EXECUTABLE ? [] : ['desktop']), '--offerdesk-import', path.join(profile, '不存在的岗位.json'), `--user-data-dir=${profile}`]);
      let error = '';
      child.stderr.on('data', chunk => error += chunk);
      const timer = setTimeout(() => { child.kill(); reject(new Error('Removed CLI did not exit')); }, 10000);
      child.once('error', reason => { clearTimeout(timer); reject(reason); });
      child.once('exit', code => { clearTimeout(timer); resolve({ code, error }); });
    });
    expect(removed.code).toBe(1);
    expect(removed.error).toContain('文件导入已移除，请通过 MCP');
    await page.getByRole('button', { name: '关闭', exact: true }).click();
    await expect(page.locator('.draft-row')).toHaveCount(0);
  } finally { await app.close(); await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
});

test('WorkBuddy、DSH、ZCode、OpenCode生成的 MCP 配置可连接导入', async () => {
  const profile = await mkdtemp(path.join(tmpdir(), 'offerdesk-target-harness-'));
  const app = await launch(profile);
  try {
    const page = await app.firstWindow();
    await page.getByRole('button', { name: 'AI 采集与导入', exact: true }).click();
    for (const [id, name] of [['workbuddy', 'WorkBuddy'], ['deepseek-harness', 'DSH'], ['zcode', 'ZCode'], ['opencode', 'OpenCode']]) {
      await page.getByRole('group', { name: '选择 AI 工具' }).getByRole('button', { name, exact: true }).click();
      const value = JSON.parse(await page.getByLabel(id === 'deepseek-harness' ? 'Cordis 补丁' : 'MCP 配置').inputValue());
      const configured = id === 'deepseek-harness' ? value[0].insert[0].config : id === 'zcode' || id === 'opencode' ? value.mcp.servers.offerdesk : value.mcpServers.offerdesk;
      const entry = id === 'opencode' ? { command: configured.command[0], args: configured.command.slice(1) } : configured;
      const client = mcp(profile, entry);
      try {
        // DSH first probes modern discovery, then starts a legacy connection.
        if (id === 'deepseek-harness') expect((await client.call('server/discover')).error.code).toBe(-32601);
        expect((await client.call('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: id + '-config-test', version: '1' } })).result.protocolVersion).toBe('2025-11-25');
        expect(result(await client.call('tools/call', { name: 'get_import_spec' })).version).toBe(1);
        const imported = result(await client.call('tools/call', { name: 'import_jobs', arguments: { batch_id: id, jobs: [{ ...job, source_url: 'https://example.com/jobs?id=' + id }] } }));
        expect(imported.results[0].status).toBe('created');
      } finally {
        await stopMcp(client.child);
      }
    }
    await page.getByRole('button', { name: '关闭', exact: true }).click();
    await expect(page.getByText('外部导入待核对 · 4 条')).toBeVisible();
  } finally { await app.close(); await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
});
