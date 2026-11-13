import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
const require = createRequire(import.meta.url);
const { harnessConfigs } = require('../desktop/harness-config.cjs');
const { SUPPORTED_PROTOCOLS } = require('../desktop/mcp-stdio.cjs');
test('不同客户端配置保留包含中文、空格和Windows反斜线的命令与参数', () => {
    for (const command of ['/Applications/Offer Desk.app/Contents/MacOS/OfferDesk', 'C:\\Users\\用户\\Offer Desk\\OfferDesk.exe']) {
        const args = ['--offerdesk-mcp', '--user-data-dir=/目录/空 格'];
        const configs = harnessConfigs(command, args);
        for (const config of configs) {
            assert.equal(config.setup.steps.length, 3);
            assert.equal(config.connection.command, command);
            assert.deepEqual(config.connection.args, args);
            assert.equal(config.connection.cwd, command.startsWith('C:') ? 'C:\\Users\\用户\\Offer Desk' : '/Applications/Offer Desk.app/Contents/MacOS');
            assert.ok(config.verifyPrompt.includes('get_import_spec'));
            assert.ok(config.taskPrompt.includes('import_jobs'));
        }
        for (const config of configs.filter((item: any) => item.id !== 'codex')) {
            const value = JSON.parse(config.config);
            const entry = value.mcpServers?.offerdesk || value[0]?.insert[0]?.config || value.mcp?.servers?.offerdesk;
            assert.ok(entry);
            if (config.id === 'opencode') {
                assert.deepEqual(entry.command, [command, ...args]);
                assert.equal(entry.type, 'local'); assert.equal(entry.protocol, 'legacy');
            } else { assert.equal(entry.command, command); assert.deepEqual(entry.args, args); }
        }
        const codex = configs.find((item: any) => item.id === 'codex').config;
        assert.equal(JSON.parse(codex.split('\n')[1].slice('command = '.length)), command);
        assert.deepEqual(JSON.parse(codex.split('\n')[2].slice('args = '.length)), args);
    }
});
for (const directDescriptor of [false, true]) test(`MCP版本协商、目录探测与分片消息（${directDescriptor ? 'Windows描述符兼容分支' : '标准输入流'}）`, async () => {
    const setup = directDescriptor ? "Object.defineProperty(process, 'platform', { value: 'win32' }); process.versions.electron = 'test';" : '';
    const child = spawn(process.execPath, ['-e', setup + "require('./desktop/mcp-stdio.cjs').start(undefined, () => process.exit(0))"]);
    const lines = createInterface({ input: child.stdout });
    const pending = new Map<number | null, (value: any) => void>(); let sequence = 0;
    lines.on('line', line => { const value = JSON.parse(line); pending.get(value.id)?.(value); });
    function send(method: string, params = {}) {
        const id = ++sequence;
        return new Promise<any>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('MCP timeout')), 3000);
            pending.set(id, result => { clearTimeout(timer); pending.delete(id); resolve(result); });
            const wire = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
            child.stdin.write(wire.slice(0, 10)); child.stdin.write(wire.slice(10));
        });
    }
    try {
        for (const protocolVersion of SUPPORTED_PROTOCOLS) {
            const response = await send('initialize', { protocolVersion, clientInfo: { name: '兼容客户端', version: '1' }, capabilities: {} });
            assert.equal(response.result.protocolVersion, protocolVersion);
            child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
        }
        assert.equal((await send('initialize', { protocolVersion: 'unknown' })).result.protocolVersion, SUPPORTED_PROTOCOLS[0]);
        assert.deepEqual((await send('resources/list')).result.resources, []);
        assert.deepEqual((await send('resources/templates/list')).result.resourceTemplates, []);
        assert.deepEqual((await send('prompts/list')).result.prompts, []);
        assert.equal((await send('tools/list')).result.tools.length, 2);
        assert.equal((await send('server/discover')).error.code, -32601); // Modern clients can fall back to legacy.
        assert.equal((await send('tools/call', { name: 'unknown' })).result.isError, true);
    } finally { lines.close(); child.kill(); }
});

test('仅提供六个 MCP 客户端模板，并保留各自配置格式', () => {
    const configs = harnessConfigs('/Applications/OfferDesk.app/Contents/MacOS/OfferDesk', ['--offerdesk-mcp']);
    assert.deepEqual(configs.map((item: any) => item.id), ['codex', 'claude', 'deepseek-harness', 'zcode', 'workbuddy', 'opencode']);
    const get = (id: string) => configs.find((item: any) => item.id === id);
    assert.equal(JSON.parse(get('workbuddy').config).mcpServers.offerdesk.command, '/Applications/OfferDesk.app/Contents/MacOS/OfferDesk');
    const patch = JSON.parse(get('deepseek-harness').config)[0].insert[0];
    assert.equal(patch.name, '@deepseek-ai/dsh-mcp-client');
    assert.equal(patch.config.serverName, 'offerdesk');
    assert.equal(patch.config.transport, 'stdio');
    const zcode = JSON.parse(get('zcode').config);
    assert.equal(zcode.features.mcp, true);
    assert.equal(zcode.mcp.servers.offerdesk.type, 'stdio');
    assert.equal(zcode.mcp.servers.offerdesk.protocolVersion, 'legacy');
});
