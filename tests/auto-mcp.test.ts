import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { harnessConfigs } = require('../desktop/harness-config.cjs');
const { prepare, publicPlan, apply, checkService } = require('../desktop/auto-mcp.cjs');
const configs = harnessConfigs('/Applications/Offer Desk.app/Contents/MacOS/OfferDesk', ['--offerdesk-mcp', '--user-data-dir=/数据/空 格']);
const get = (id: string) => configs.find((item: any) => item.id === id);
function fixture() {
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'offerdesk-auto-'));
    const options = { homeDir, appDataDir: path.join(homeDir, 'appdata'), env: {}, findExecutable: () => null };
    const write = (file: string, value: unknown) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value), { mode: 0o600 }); };
    return { options, write, clean: () => fs.rmSync(homeDir, { recursive: true, force: true }) };
}

test('本机配置预览不泄露已有配置，写入仅更新 OfferDesk 并保留其他服务器', async () => {
    const f = fixture();
    try {
        const filename = path.join(f.options.homeDir, '.workbuddy', 'mcp.json');
        const original = { models: { apiKey: 'fixture-secret' }, mcpServers: { other: { command: 'other', args: ['keep'] }, offerdesk: { command: 'old' } } };
        f.write(filename, original);
        const plan = prepare(get('workbuddy'), 'desktop', f.options);
        assert.equal(plan.ready, true);
        const view = publicPlan(plan, 'token');
        assert.equal(JSON.stringify(view).includes('fixture-secret'), false);
        assert.equal('before' in view, false); assert.equal('after' in view, false);
        await apply(plan);
        const updated = JSON.parse(fs.readFileSync(filename, 'utf8'));
        assert.deepEqual(updated.models, original.models);
        assert.deepEqual(updated.mcpServers.other, original.mcpServers.other);
        assert.deepEqual(updated.mcpServers.offerdesk, { command: get('workbuddy').connection.command, args: get('workbuddy').connection.args });
        const next = prepare(get('workbuddy'), 'desktop', f.options);
        assert.equal(next.configured, true);
        await apply(next);
        assert.deepEqual(fs.readdirSync(path.dirname(filename)), ['mcp.json']);
    } finally { f.clean(); }
});

test('预览后配置发生变化或预览过期时拒绝写入', async () => {
    const f = fixture();
    try {
        const filename = path.join(f.options.homeDir, '.workbuddy', 'mcp.json');
        f.write(filename, {});
        const plan = prepare(get('workbuddy'), 'desktop', f.options);
        f.write(filename, { changed: true });
        await assert.rejects(apply(plan), /发生变化/);
        assert.deepEqual(JSON.parse(fs.readFileSync(filename, 'utf8')), { changed: true });
        const expired = prepare(get('workbuddy'), 'desktop', f.options);
        expired.createdAt -= 6 * 60 * 1000;
        await assert.rejects(apply(expired), /过期/);
    } finally { f.clean(); }
});

test('非法 JSON、错误层级和链接配置文件不会被覆盖', { skip: process.platform === 'win32' }, async () => {
    const f = fixture();
    try {
        const filename = path.join(f.options.homeDir, '.workbuddy', 'mcp.json');
        f.write(filename, '{ // keep this comment\n "mcpServers": {},\n}');
        assert.equal(prepare(get('workbuddy'), 'desktop', f.options).ready, false);
        f.write(filename, { mcpServers: [] });
        assert.throws(() => prepare(get('workbuddy'), 'desktop', f.options), /层级不兼容/);
        const linked = path.join(f.options.homeDir, 'linked.json');
        f.write(linked, { protected: true }); fs.unlinkSync(filename); fs.symlinkSync(linked, filename);
        assert.throws(() => prepare(get('workbuddy'), 'desktop', f.options), /链接/);
        assert.equal(fs.readFileSync(linked, 'utf8'), '{"protected":true}');
    } finally { f.clean(); }
});

test('Claude Code 与 Desktop 使用各自的用户配置，保留项目与偏好', async () => {
    const f = fixture();
    try {
        const codeFile = path.join(f.options.homeDir, '.claude.json');
        const desktopFile = path.join(f.options.appDataDir, 'Claude', 'claude_desktop_config.json');
        f.write(codeFile, { projects: { example: { allowedTools: [] } } });
        f.write(desktopFile, { preferences: { keep: true } });
        await apply(prepare(get('claude'), 'code', f.options));
        assert.deepEqual(JSON.parse(fs.readFileSync(desktopFile, 'utf8')), { preferences: { keep: true } });
        await apply(prepare(get('claude'), 'desktop', f.options));
        assert.equal(JSON.parse(fs.readFileSync(codeFile, 'utf8')).mcpServers.offerdesk.type, 'stdio');
        assert.deepEqual(JSON.parse(fs.readFileSync(codeFile, 'utf8')).projects, { example: { allowedTools: [] } });
        assert.equal(JSON.parse(fs.readFileSync(desktopFile, 'utf8')).preferences.keep, true);
        assert.throws(() => prepare(get('claude'), 'unknown', f.options), /请选择/);
    } finally { f.clean(); }
});

test('ZCode 开启 MCP 并保留其他功能开关；OpenCode 使用 V2 用户配置', async () => {
    const f = fixture();
    try {
        const zcodeFile = path.join(f.options.homeDir, '.zcode', 'cli', 'config.json');
        f.write(zcodeFile, { features: { mcp: false, keep: true }, model: 'keep', mcp: { servers: { other: { type: 'stdio', command: 'keep' } } } });
        await apply(prepare(get('zcode'), 'desktop', f.options));
        const zcode = JSON.parse(fs.readFileSync(zcodeFile, 'utf8'));
        assert.equal(zcode.features.mcp, true); assert.equal(zcode.features.keep, true); assert.equal(zcode.model, 'keep');
        assert.equal(zcode.mcp.servers.other.command, 'keep'); assert.equal(zcode.mcp.servers.offerdesk.protocolVersion, 'legacy');
        const opencodeFile = path.join(f.options.homeDir, '.config', 'opencode', 'opencode.json');
        f.write(opencodeFile, { model: 'keep' });
        await apply(prepare(get('opencode'), 'desktop', f.options));
        const opencode = JSON.parse(fs.readFileSync(opencodeFile, 'utf8'));
        assert.equal(opencode.model, 'keep'); assert.equal(opencode.mcp.servers.offerdesk.type, 'local');
        assert.deepEqual(opencode.mcp.servers.offerdesk.command, [get('opencode').connection.command, ...get('opencode').connection.args]);
    } finally { f.clean(); }
});

test('官方 CLI 使用参数数组而非 shell，保留中文、空格和全局作用域', async () => {
    const f = fixture();
    try {
        const options = { ...f.options, findExecutable: (name: string) => path.join(f.options.homeDir, name + '-binary') };
        for (const id of ['codex', 'opencode']) {
            const plan = prepare(get(id), 'desktop', options);
            assert.equal(plan.ready, true);
            const calls: any[] = [];
            await apply(plan, { runCli: async (...args: any[]) => { calls.push(args); return { stdout: JSON.stringify({ transport: get(id).connection }) }; } });
            assert.equal(calls.length, id === 'codex' ? 2 : 1);
            assert.deepEqual(calls[0][1].slice(-3), [get(id).connection.command, ...get(id).connection.args]);
            assert.equal(calls[0][2].shell, undefined);
            if (id === 'opencode') assert.ok(calls[0][1].includes('--global'));
            else assert.deepEqual(calls[1][1], ['mcp', 'get', 'offerdesk', '--json']);
        }
    } finally { f.clean(); }
});

test('缺少客户端或需指定 DSH 会话时只给出手动步骤，不创建外部配置', () => {
    const f = fixture();
    try {
        for (const id of ['codex', 'claude', 'deepseek-harness', 'zcode', 'workbuddy', 'opencode']) assert.equal(prepare(get(id), 'desktop', f.options).ready, false);
        assert.deepEqual(fs.readdirSync(f.options.homeDir), []);
        assert.throws(() => prepare({ ...get('codex'), id: 'unknown' }, 'desktop', f.options), /不支持/);
    } finally { f.clean(); }
});

test('MCP 服务自检实际握手并查询格式，不导入数据；失败与超时可结束', async () => {
    const f = fixture();
    try {
        const code = `require(${JSON.stringify(require.resolve('../desktop/mcp-stdio.cjs'))}).start(${JSON.stringify(f.options.homeDir)}, () => process.exit(0))`;
        assert.equal(await checkService({ command: process.execPath, args: ['-e', code] }), true);
        assert.deepEqual(fs.readdirSync(f.options.homeDir), []);
        assert.equal(await checkService({ command: process.execPath, args: ['-e', 'process.exit(2)'] }), false);
        assert.equal(await checkService({ command: process.execPath, args: ['-e', 'setInterval(() => {}, 1000)'] }, 100), false);
    } finally { f.clean(); }
});
