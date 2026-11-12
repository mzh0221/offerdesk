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
const launch = (profile: string) => electron.launch({
  ...(process.env.OFFERDESK_TEST_EXECUTABLE ? { executablePath: process.env.OFFERDESK_TEST_EXECUTABLE } : {}),
  args: [...(process.env.OFFERDESK_TEST_EXECUTABLE ? [] : ['desktop']), `--user-data-dir=${profile}`],
});
const job = { source: '测试企业官网', source_url: 'https://example.com/jobs?id=123&utm_source=agent', raw_text: '测试公司招聘前端实习生，杭州。', fields: { company: 'MCP测试公司', title: 'MCP前端实习生', city: '杭州' } };
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
    await expect(page.getByRole('heading', { name: '岗位与投递', exact: true })).toBeVisible();
    const call = (args: unknown) => client.call('tools/call', { name: 'import_jobs', arguments: args });
    const args = { batch_id: 'batch-1', jobs: [job, { ...job, raw_text: '' }, { ...job, source_url: 'https://example.com/jobs?id=123#top' }] };
    // The heading can render before the main process receives the import-ready handshake.
    let firstResponse: any;
    await expect.poll(async () => { firstResponse = await call(args); return firstResponse.result.isError ?? false; }).toBe(false);
    const first = result(firstResponse);
    expect(first.results.map((r: any) => r.status)).toEqual(['created', 'invalid', 'duplicate']);
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
    await page.getByRole('button', { name: '保存到岗位列表', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.jobs-table tbody tr')).toHaveCount(1);
    expect(result(await call({ batch_id: 'after-save', jobs: [job] })).results[0].status).toBe('duplicate');
    await app.close(); app = undefined;
    expect((await call({ batch_id: 'closed', jobs: [job] })).result.isError).toBe(true);
  } finally { const exited = new Promise(resolve => client.child.once('exit', resolve)); client.child.kill(); await exited; if (app) await app.close(); await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
});

test('通用接入配置、JSON文件及CLI导入共用草稿校验', async () => {
  const profile = await mkdtemp(path.join(tmpdir(), 'offerdesk-harness-test-'));
  const app = await launch(profile);
  try {
    const page = await app.firstWindow();
    await page.getByRole('button', { name: 'AI 工具接入', exact: true }).click();
    await expect(page.getByLabel('MCP 配置')).toContainText('--offerdesk-mcp');
    await page.getByLabel('选择 AI 工具').selectOption('opencode');
    const config = JSON.parse(await page.getByLabel('MCP 配置').inputValue());
    expect(config.mcp.servers.offerdesk.type).toBe('local');
    expect(config.mcp.servers.offerdesk.command).toContain('--offerdesk-mcp');
    await page.screenshot({ path: test.info().outputPath('ai-import.png'), animations: 'disabled' });
    const batch = { batch_id: 'file-batch', jobs: [job] };
    await page.getByLabel('选择岗位 JSON 文件').setInputFiles({ name: 'jobs.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(batch)) });
    await expect(page.getByRole('dialog').getByRole('status')).toContainText('已创建 1 条草稿');
    await page.getByLabel('选择岗位 JSON 文件').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('broken json') });
    await expect(page.getByRole('alert')).toContainText('文件不是有效 JSON');
    const executable = process.env.OFFERDESK_TEST_EXECUTABLE || String(require('electron'));
    async function cli(filename: string, input?: string) {
      return new Promise<any>((resolve, reject) => {
        const child = spawn(executable, [...(process.env.OFFERDESK_TEST_EXECUTABLE ? [] : ['desktop']), '--offerdesk-import', filename, `--user-data-dir=${profile}`]);
        let output = ''; let error = '';
        child.stdout.on('data', chunk => output += chunk); child.stderr.on('data', chunk => error += chunk);
        const timer = setTimeout(() => { child.kill(); reject(new Error('CLI timeout')); }, 10000);
        child.on('error', reject);
        child.on('exit', code => { clearTimeout(timer); if (code === 0) resolve(JSON.parse(output)); else reject(new Error(error)); });
        child.stdin.end(input);
      });
    }
    const { writeFile } = await import('node:fs/promises');
    const filename = path.join(profile, '岗位.json');
    await writeFile(filename, JSON.stringify({ batch_id: 'cli-file', jobs: [job] }));
    expect((await cli(filename)).results[0].status).toBe('duplicate');
    expect((await cli('-', JSON.stringify({ batch_id: 'cli-stdin', jobs: [job] }))).results[0].status).toBe('duplicate');
    await page.getByRole('button', { name: '关闭', exact: true }).click();
    await expect(page.getByText('外部导入待核对 · 1 条')).toBeVisible();
  } finally { await app.close(); await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
});

test('WorkBuddy、DSH、ZCode生成配置可连接导入；豆包提供文件提示词', async () => {
  const profile = await mkdtemp(path.join(tmpdir(), 'offerdesk-target-harness-'));
  const app = await launch(profile);
  try {
    const page = await app.firstWindow();
    await page.getByRole('button', { name: 'AI 工具接入', exact: true }).click();
    for (const id of ['workbuddy', 'deepseek-harness', 'zcode']) {
      await page.getByLabel('选择 AI 工具').selectOption(id);
      const value = JSON.parse(await page.getByLabel(id === 'deepseek-harness' ? 'Cordis 补丁' : 'MCP 配置').inputValue());
      const entry = id === 'deepseek-harness' ? value[0].insert[0].config : id === 'zcode' ? value.mcp.servers.offerdesk : value.mcpServers.offerdesk;
      const client = mcp(profile, entry);
      try {
        // DSH first probes modern discovery, then starts a legacy connection.
        if (id === 'deepseek-harness') expect((await client.call('server/discover')).error.code).toBe(-32601);
        expect((await client.call('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: id + '-config-test', version: '1' } })).result.protocolVersion).toBe('2025-11-25');
        expect(result(await client.call('tools/call', { name: 'get_import_spec' })).version).toBe(1);
        const imported = result(await client.call('tools/call', { name: 'import_jobs', arguments: { batch_id: id, jobs: [{ ...job, source_url: 'https://example.com/jobs?id=' + id }] } }));
        expect(imported.results[0].status).toBe('created');
      } finally {
        const exited = new Promise(resolve => client.child.once('exit', resolve)); client.child.kill(); await exited;
      }
    }
    await page.getByLabel('选择 AI 工具').selectOption('doubao-work');
    await expect(page.getByLabel('MCP 配置')).toHaveCount(0);
    await expect(page.getByLabel('岗位 JSON 示例')).toBeVisible();
    await expect(page.getByLabel('采集任务提示词')).toContainText('不声称已经写入我的本机应用');
    const example = JSON.parse(await page.getByLabel('岗位 JSON 示例').inputValue());
    const batch = { ...example, batch_id: 'doubao-file-test', jobs: [{ ...job, source_url: 'https://example.com/jobs?id=doubao' }] };
    await page.getByLabel('选择岗位 JSON 文件').setInputFiles({ name: '豆包岗位.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(batch)) });
    await expect(page.getByRole('dialog').getByRole('status')).toContainText('已创建 1 条草稿');
    await page.screenshot({ path: test.info().outputPath('doubao-import.png'), animations: 'disabled' });
    await page.getByRole('button', { name: '关闭', exact: true }).click();
    await expect(page.getByText('外部导入待核对 · 4 条')).toBeVisible();
  } finally { await app.close(); await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
});
