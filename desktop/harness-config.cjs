// Shared connection snippets for manual setup and the explicit local setup flow.
function harnessConfigs(command, args) {
  const path = require('node:path');
  const windows = /^[a-z]:[\\/]|^\\\\/i.test(command);
  const cwd = (windows ? path.win32 : path.posix).dirname(command);
  const home = windows ? '%USERPROFILE%' : '~';
  const entry = { command, args };
  const json = value => JSON.stringify(value, null, 2);
  const generic = json({ mcpServers: { offerdesk: entry } });
  const verifyPrompt = '请只调用 OfferDesk 的 get_import_spec，告诉我返回的 version 和每批岗位上限。不要搜索岗位，也不要调用 import_jobs 或导入任何数据。如果找不到工具，请直接说明尚未连接。';
  const collectPrompt = '请寻找杭州或上海的前端实习岗位。先调用 OfferDesk 的 get_import_spec 查看格式，再搜索并读取招聘详情，保留来源链接和完整原文，调用 import_jobs 导入待核对草稿。未写明的信息留空，不编造、不自动投递。最后告诉我成功、重复和失败各多少条。';
  const setup = {
    codex: { steps: ['在 Codex / ChatGPT 桌面端打开“设置 → MCP 服务器 → 添加服务器”（IDE 扩展从齿轮菜单进入）。', '选择 STDIO，按下方逐项填写；启动命令与参数分别复制，参数每项单独添加。', '保存后重启该 MCP 服务或客户端；在新对话输入 /mcp，查看 offerdesk 是否可用。'], file: `${home}/.codex/config.toml`, merge: '将 [mcp_servers.offerdesk] 段添加到文件末尾；已有同名段时更新该段，不要重复添加。' },
    claude: { steps: ['Claude Code：在当前项目根目录打开或新建 .mcp.json。Claude Desktop：打开本地 MCP 的开发者配置（旧版“设置 → Developer → Edit Config”）。', '点击“复制配置”。空文件可粘贴整段；已有 mcpServers 时只把 offerdesk 加入其中，保留其他服务器。', 'Claude Code 重新打开会话，并在 /mcp 中确认或批准项目服务器；Claude Desktop 完全退出后重新打开，再查看本地 MCP / Connectors。'], file: windows ? '%APPDATA%\\Claude\\claude_desktop_config.json' : '~/Library/Application Support/Claude/claude_desktop_config.json', merge: 'Claude Code 使用项目 .mcp.json；上方路径是 Claude Desktop 的配置文件。两者均合并 mcpServers.offerdesk。' },
    'deepseek-harness': { steps: ['将下方“Cordis 补丁”复制并保存为 offerdesk.cordis.yml，记住文件的绝对路径。JSON 也是合法 YAML，可直接保存。', '在终端运行 dsh web --patch "/绝对路径/offerdesk.cordis.yml"，把引号内替换为刚保存的文件路径。已有补丁时合并 insert 条目。', '在这个新启动的 DSH 会话中查看 OfferDesk 工具，再发送下方连接检查提示词。'], file: 'offerdesk.cordis.yml', merge: '这是 Cordis 补丁，不是通用 mcpServers JSON；必须通过 --patch 加载。' },
    zcode: { steps: ['打开 ZCode 用户配置 ~/.zcode/cli/config.json（Windows 为 %USERPROFILE%\\.zcode\\cli\\config.json），或当前项目的 zcode.json。', '点击“复制配置”，合并 features.mcp 与 mcp.servers.offerdesk，保留已有模型和其他服务器配置。', '保存后重新打开 ZCode 会话，在 MCP 设置中查看 offerdesk，再发送下方检查提示词。'], file: `${home}/.zcode/cli/config.json`, merge: '合并 mcp.servers.offerdesk，并保持 features.mcp 为 true；不要放进 mcpServers。' },
    workbuddy: { steps: ['在 WorkBuddy 进入“插件 → MCP 服务器 → 配置 MCP”；部分版本入口位于“设置 → MCP”。', '点击“复制配置”，粘贴到 JSON 配置中；已有 mcpServers 时只合并 offerdesk。若界面要求逐项填写，展开下方 STDIO 表单值。', '保存、启用 offerdesk 并重新连接；必要时重启 WorkBuddy，再在新对话发送下方检查提示词。'], file: 'WorkBuddy 的 MCP 配置编辑器', merge: '合并 mcpServers.offerdesk；表单模式使用本地 STDIO，不填远程 URL。' },
    opencode: { steps: ['在 OpenCode 当前项目根目录打开或新建 opencode.json / opencode.jsonc（本配置适用于 V2）。', '点击“复制配置”，将 offerdesk 合并到 mcp.servers。已有 mcp 时保留其中其他内容。', '保存后重启 OpenCode，在 /mcps 或 opencode mcp list 中查看 offerdesk，再发送下方检查提示词。'], file: '项目根目录 / opencode.json（或 opencode.jsonc）', merge: 'V2 使用 mcp.servers.offerdesk，type 为 local，command 是包含可执行文件和各参数的数组。' },
  };
  return [
    { id: 'codex', name: 'Codex', subtitle: '本地 MCP 连接', destination: 'Codex MCP 配置（config.toml）', config: `[mcp_servers.offerdesk]\ncommand = ${JSON.stringify(command)}\nargs = ${JSON.stringify(args)}\n` },
    { id: 'claude', name: 'Claude', subtitle: 'Code / Desktop', destination: 'Claude Code 的 .mcp.json，或 Claude Desktop 的 claude_desktop_config.json；合并 mcpServers', config: generic },
    { id: 'deepseek-harness', name: 'DSH', subtitle: 'DeepSeek Harness', destination: '保存为 offerdesk.cordis.yml，以 dsh web --patch 文件绝对路径加载；以下 JSON 是合法 YAML，已有补丁须合并 insert 条目', configLabel: 'Cordis 补丁', config: json([{ insert: [{ id: 'mcp-offerdesk', name: '@deepseek-ai/dsh-mcp-client', config: { serverName: 'offerdesk', transport: 'stdio', ...entry } }] }]) },
    { id: 'zcode', name: 'ZCode', subtitle: '智谱 · 本地连接', destination: '~/.zcode/cli/config.json 或项目 zcode.json；启用 features.mcp，合并 mcp.servers.offerdesk', config: json({ features: { mcp: true }, mcp: { servers: { offerdesk: { type: 'stdio', ...entry, enabled: true, protocolVersion: 'legacy' } } } }) },
    { id: 'workbuddy', name: 'WorkBuddy', subtitle: '腾讯 · 本地连接', destination: '~/.workbuddy/mcp.json 或项目 .workbuddy/mcp.json；插件 → MCP 服务器 → 配置 MCP，合并 mcpServers', config: generic },
    { id: 'opencode', name: 'OpenCode', subtitle: '本地 MCP 连接', destination: 'OpenCode V2 的 opencode.json 或 opencode.jsonc；合并 mcp.servers.offerdesk', config: json({ mcp: { servers: { offerdesk: { type: 'local', command: [command, ...args], protocol: 'legacy' } } } }) },
  ].map(item => ({ ...item, setup: setup[item.id], connection: { command, args: [...args], cwd }, verifyPrompt, taskPrompt: collectPrompt }));
}
module.exports = { harnessConfigs };
