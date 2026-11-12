// Generate snippets only. Never modify another application's configuration.
function harnessConfigs(command, args) {
  const entry = { command, args };
  const json = value => JSON.stringify(value, null, 2);
  const generic = json({ mcpServers: { offerdesk: entry } });
  const example = require('./mcp-stdio.cjs').spec.example;
  const filePrompt = `请按我给出的岗位关键词、城市和其他条件查找招聘信息，读取详情原文并提供可下载的 UTF-8 jobs.json 文件。
每批1—50条，整个文件不超过4MB；batch_id 使用本次任务唯一标识。仅提取原文明确的信息，不根据摘要编造，不自动投递。
每条必须含 source（来源名称）、source_url（HTTP(S)详情链接）、raw_text（非空招聘原文，最多30000字符）、fields（company与title必填）。
可选文本字段 city、salary、education、graduation_year、internship_duration、days_per_week、job_type，未知时省略或null；可选数组 required、preferred、availability、tags，未知时省略或[]。
普通数组最多40项、每项最多2000字符；tags最多15项、每项最多40字符。公司和岗位名称各最多200字符。
请按下列结构替换示例内容；示例不是真实岗位，不应混入结果。无法提供下载文件时输出完整纯JSON，供我保存为jobs.json。
${json(example)}
交付后提示我在 OfferDesk 的“AI 工具接入”中选择JSON文件，核对后保存。本任务不需要配置远程MCP，也不声称已经写入我的本机应用。`;
  return [
    { id: 'workbuddy', name: 'WorkBuddy（腾讯）', destination: '~/.workbuddy/mcp.json 或项目 .workbuddy/mcp.json；插件 → MCP 服务器 → 配置 MCP，合并 mcpServers', config: generic },
    { id: 'deepseek-harness', name: 'DeepSeek Harness（DSH）', destination: '保存为 offerdesk.cordis.yml，以 dsh web --patch 文件绝对路径加载；以下 JSON 是合法 YAML，已有补丁须合并 insert 条目', configLabel: 'Cordis 补丁', config: json([{ insert: [{ id: 'mcp-offerdesk', name: '@deepseek-ai/dsh-mcp-client', config: { serverName: 'offerdesk', transport: 'stdio', ...entry } }] }]) },
    { id: 'zcode', name: 'ZCode（智谱）', destination: '~/.zcode/cli/config.json 或项目 zcode.json；启用 features.mcp，合并 mcp.servers.offerdesk', config: json({ features: { mcp: true }, mcp: { servers: { offerdesk: { type: 'stdio', ...entry, enabled: true, protocolVersion: 'legacy' } } } }) },
    { id: 'doubao-work', name: '豆包工作（JSON 文件导入）', kind: 'file', destination: '将下面的提示词发给豆包工作，生成岗位 JSON 文件后在此选择文件导入。豆包应用插件要求公网远程 MCP，本地模式使用文件导入', configLabel: '岗位 JSON 示例', config: json(example), taskPrompt: filePrompt },
    { id: 'codex', name: 'Codex', destination: 'Codex MCP 配置（config.toml）', config: `[mcp_servers.offerdesk]\ncommand = ${JSON.stringify(command)}\nargs = ${JSON.stringify(args)}\n` },
    { id: 'claude', name: 'Claude Code / Claude Desktop', destination: 'Claude Code 的 .mcp.json，或 Claude Desktop 的 claude_desktop_config.json；合并 mcpServers', config: generic },
    { id: 'cursor', name: 'Cursor', destination: 'Cursor MCP 设置中的 mcp.json；合并 mcpServers', config: generic },
    { id: 'gemini', name: 'Gemini CLI', destination: '~/.gemini/settings.json；合并 mcpServers', config: generic },
    { id: 'cline', name: 'Cline / 通用 MCP 客户端', destination: '客户端的本地 STDIO MCP 设置；合并 mcpServers（Cline 可在 MCP Servers 面板打开配置）', config: generic },
    { id: 'vscode', name: 'VS Code（mcp.json 格式）', destination: 'VS Code 的 .vscode/mcp.json；使用 servers。新 Copilot harness 也可通过 Add Server → Command (stdio) 填入命令与参数', config: json({ servers: { offerdesk: { type: 'stdio', ...entry } } }) },
    { id: 'opencode', name: 'OpenCode V2', destination: 'opencode.json；合并 mcp.servers', config: json({ mcp: { servers: { offerdesk: { type: 'local', command: [command, ...args], protocol: 'legacy' } } } }) },
    { id: 'opencode-v1', name: 'OpenCode V1', destination: 'opencode.json；合并 mcp（仅 V1）', config: json({ mcp: { offerdesk: { type: 'local', command: [command, ...args], enabled: true } } }) },
  ];
}
module.exports = { harnessConfigs };
