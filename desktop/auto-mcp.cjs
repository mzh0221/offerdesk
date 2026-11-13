const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile, spawn } = require('node:child_process');
const { promisify, isDeepStrictEqual } = require('node:util');
const runFile = promisify(execFile);
const LIMIT = 8 * 1024 * 1024;

function executable(name, { homeDir, env = {}, platform = process.platform }) {
  const dirs = [...(env.PATH || '').split(path.delimiter), path.join(homeDir, '.local', 'bin'), path.join(homeDir, '.npm-global', 'bin')];
  if (platform !== 'win32') dirs.push('/opt/homebrew/bin', '/usr/local/bin', '/usr/bin');
  if (platform === 'darwin' && name === 'codex') dirs.unshift('/Applications/Codex.app/Contents/Resources');
  // Shell wrappers are not executed: all CLI arguments go directly to a binary.
  const names = platform === 'win32' ? [name + '.exe', name] : [name];
  for (const dir of dirs.filter(Boolean)) for (const filename of names) {
    const target = path.join(dir, filename);
    try { if (fs.statSync(target).isFile()) { fs.accessSync(target, platform === 'win32' ? fs.constants.F_OK : fs.constants.X_OK); return target; } } catch {}
  }
  return null;
}

function snapshot(filename) {
  try {
    const stat = fs.lstatSync(filename);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink > 1) throw new Error('配置文件是链接或特殊文件，请使用下方手动配置。');
    if (stat.size > LIMIT) throw new Error('配置文件较大，请使用下方手动配置。');
    const bytes = fs.readFileSync(filename);
    return { text: bytes.toString('utf8'), hash: crypto.createHash('sha256').update(bytes).digest('hex'), mode: stat.mode & 0o777 };
  } catch (error) {
    if (error.code === 'ENOENT') return { text: '', hash: null, mode: 0o600 };
    throw error;
  }
}

function record(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
function update(root, keys, value) {
  let current = root;
  for (const key of keys.slice(0, -1)) {
    if (!Object.hasOwn(current, key)) current[key] = {};
    if (!record(current[key])) throw new Error('已有配置的层级不兼容，请使用下方手动配置。');
    current = current[key];
  }
  current[keys.at(-1)] = value;
}
function read(root, keys) { return keys.reduce((value, key) => record(value) && Object.hasOwn(value, key) ? value[key] : undefined, root); }
function firstExisting(candidates) { return candidates.find(filename => fs.existsSync(filename)) || candidates[0]; }

function prepare(config, variant, options) {
  const { homeDir, appDataDir, env = {}, platform = process.platform } = options;
  const { id, connection } = config;
  const plan = { toolId: id, variant, createdAt: Date.now(), connection, ready: false, name: config.name };
  if (id === 'deepseek-harness') return { ...plan, message: 'DSH 需在目标会话加载 Cordis 补丁，请使用下方三步说明。' };
  let target;
  let cli;
  let args;
  let keys;
  let entry = { command: connection.command, args: connection.args };
  if (id === 'codex') {
    target = path.join(env.CODEX_HOME || path.join(homeDir, '.codex'), 'config.toml');
    cli = (options.findExecutable || executable)('codex', options);
    if (!cli) return { ...plan, target, message: '未找到可直接运行的 Codex CLI。可安装官方 CLI 后重试，或使用下方表单配置；不会自动安装软件。' };
    args = ['mcp', 'add', 'offerdesk', '--', connection.command, ...connection.args];
  } else if (id === 'claude') {
    if (variant !== 'code' && variant !== 'desktop') throw new Error('请选择 Claude Code 或 Claude Desktop。');
    target = variant === 'code' ? path.join(homeDir, '.claude.json')
      : path.join(appDataDir, 'Claude', 'claude_desktop_config.json');
    keys = ['mcpServers', 'offerdesk'];
    if (!fs.existsSync(target) && !fs.existsSync(variant === 'code' ? path.join(homeDir, '.claude') : path.dirname(target))) {
      return { ...plan, target, message: `未发现 ${variant === 'code' ? 'Claude Code' : 'Claude Desktop'} 的本机配置。请先打开该工具完成首次设置，再重试。` };
    }
    if (variant === 'code') entry.type = 'stdio';
  } else if (id === 'workbuddy') {
    target = path.join(homeDir, '.workbuddy', 'mcp.json');
    keys = ['mcpServers', 'offerdesk'];
    if (!fs.existsSync(target)) return { ...plan, target, message: '未发现默认位置的 WorkBuddy MCP 配置。请先从“插件 → MCP 服务器 → 配置 MCP”创建配置；自定义位置可使用下方手动配置。' };
  } else if (id === 'zcode') {
    target = path.join(homeDir, '.zcode', 'cli', 'config.json');
    keys = ['mcp', 'servers', 'offerdesk'];
    entry = { type: 'stdio', ...entry, enabled: true, protocolVersion: 'legacy' };
    if (!fs.existsSync(path.dirname(target))) return { ...plan, target, message: '未发现 ZCode 的用户配置目录。请先打开 ZCode，再重试；项目配置可使用下方手动方式。' };
  } else if (id === 'opencode') {
    const directory = path.join(env.XDG_CONFIG_HOME || path.join(homeDir, '.config'), 'opencode');
    const candidates = [path.join(directory, 'opencode.json'), path.join(directory, 'opencode.jsonc')];
    if (candidates.every(filename => fs.existsSync(filename))) return { ...plan, message: '同时发现 opencode.json 和 opencode.jsonc。请先在 OpenCode 中确认生效文件，再使用下方手动配置。' };
    target = firstExisting(candidates);
    keys = ['mcp', 'servers', 'offerdesk'];
    entry = { type: 'local', command: [connection.command, ...connection.args], protocol: 'legacy' };
    // The official CLI can preserve JSONC comments and trailing commas.
    cli = (options.findExecutable || executable)('opencode', options);
    if (cli) args = ['mcp', 'add', 'offerdesk', '--global', '--', connection.command, ...connection.args];
    else if (!fs.existsSync(directory)) return { ...plan, target, message: '未发现 OpenCode CLI 或用户配置目录。请先打开 OpenCode；项目配置可使用下方手动方式。' };
  } else throw new Error('不支持的 MCP 客户端。');

  const before = snapshot(target);
  if (cli) return { ...plan, ready: true, target, before, cli, args, method: '官方 CLI', message: '通过官方 CLI 添加或更新 offerdesk，保留其他配置。' };
  let root;
  try { root = before.text.trim() ? JSON.parse(before.text.replace(/^\uFEFF/, '')) : {}; }
  catch { return { ...plan, target, message: '配置含注释或不是有效 JSON，自动写入已停止。请使用下方手动配置；OpenCode 也可安装官方 CLI 后重试。' }; }
  if (!record(root)) throw new Error('配置根节点不是对象，请手动配置。');
  const configured = isDeepStrictEqual(read(root, keys), entry) && (id !== 'zcode' || read(root, ['features', 'mcp']) === true);
  update(root, keys, entry);
  if (id === 'zcode') update(root, ['features', 'mcp'], true);
  const indent = before.text.match(/\n([ \t]+)"/)?.[1] || '  ';
  const eol = before.text.includes('\r\n') ? '\r\n' : '\n';
  const after = (JSON.stringify(root, null, indent) + '\n').replace(/\n/g, eol);
  return { ...plan, ready: true, target, before, after, configured, method: '配置文件', message: id === 'zcode' ? '仅写入 offerdesk 条目并开启 features.mcp，保留其他服务器和模型设置。' : '仅写入 offerdesk 条目，保留其他服务器和模型设置。' };
}

function publicPlan(plan, token) {
  return { token, toolId: plan.toolId, ready: plan.ready, target: plan.target, configured: !!plan.configured, method: plan.method, message: plan.message };
}

async function apply(plan, { runCli = runFile } = {}) {
  if (!plan.ready || Date.now() - plan.createdAt > 5 * 60 * 1000) throw new Error('配置预览已过期，请重新检测。');
  if (snapshot(plan.target).hash !== plan.before.hash) throw new Error('配置在预览后发生变化，请重新检测后再写入。');
  if (plan.cli) {
    try {
      await runCli(plan.cli, plan.args, { timeout: 15000, maxBuffer: LIMIT, windowsHide: true });
      if (plan.toolId === 'codex') {
        const result = await runCli(plan.cli, ['mcp', 'get', 'offerdesk', '--json'], { timeout: 5000, maxBuffer: LIMIT, windowsHide: true });
        const value = JSON.parse(result.stdout);
        const transport = value.transport || value;
        if (transport.command !== plan.connection.command || !isDeepStrictEqual(transport.args || [], plan.connection.args)) throw new Error('配置未生效');
      }
    }
    catch { throw new Error('官方 CLI 未能完成配置。请在该工具中检查 offerdesk 条目，或使用下方手动方式。'); }
    return;
  }
  if (plan.configured) return;
  const directory = path.dirname(plan.target);
  fs.mkdirSync(directory, { recursive: true });
  const temporary = path.join(directory, '.offerdesk-' + crypto.randomUUID() + '.tmp');
  try {
    fs.writeFileSync(temporary, plan.after, { flag: 'wx', mode: plan.before.mode });
    if (snapshot(plan.target).hash !== plan.before.hash) throw new Error('配置刚被其他程序修改，请重新检测。');
    fs.renameSync(temporary, plan.target);
  } finally { fs.rmSync(temporary, { force: true }); }
}

function checkService(connection, timeout = 8000) {
  return new Promise(resolve => {
    const child = spawn(connection.command, connection.args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let buffer = ''; let bytes = 0; let finished = false;
    const timer = setTimeout(() => finish(false), timeout);
    function finish(ready) {
      if (finished) return;
      finished = true; clearTimeout(timer); child.stdin.end();
      // The subprocess is this app's own read-only MCP probe.
      if (child.exitCode === null && child.signalCode === null) child.kill();
      resolve(ready);
    }
    function send(id, method, params = {}) { if (!finished) child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); }
    child.once('error', () => finish(false));
    child.once('exit', () => finish(false));
    child.stdin.on('error', () => finish(false));
    child.stderr.on('data', () => {});
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      bytes += Buffer.byteLength(chunk);
      if (bytes > LIMIT) { finish(false); return; }
      buffer += chunk;
      let boundary;
      while ((boundary = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 1);
        let value; try { value = JSON.parse(line); } catch { continue; }
        if (value.id === 1) {
          if (!value.result?.protocolVersion) { finish(false); return; }
          child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
          send(2, 'tools/list');
        } else if (value.id === 2) {
          if (!['get_import_spec', 'import_jobs'].every(name => value.result?.tools?.some(tool => tool.name === name))) { finish(false); return; }
          send(3, 'tools/call', { name: 'get_import_spec', arguments: {} });
        } else if (value.id === 3) {
          try { finish(!value.result?.isError && JSON.parse(value.result.content[0].text).version === 1); }
          catch { finish(false); }
        }
      }
    });
    send(1, 'initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'offerdesk-local-check', version: '1' } });
  });
}

module.exports = { executable, prepare, publicPlan, apply, checkService };
