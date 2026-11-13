# MCP 配置与 AI 岗位导入

OfferDesk 已内置 MCP 服务，不用另外安装 Node.js，也不用给 OfferDesk 填模型密钥。**先打开 OfferDesk，导入期间保持它打开。AI 工具需在同一台电脑运行。**

打开 **AI 采集与导入**，点击你使用的工具卡片。应用会按当前安装位置生成命令与参数，优先复制应用中的实际值。

## 三步连接并采集

1. **连接工具**：选择 Codex、Claude 等工具，应用会自动检测可用配置；确认显示的写入位置后，点击 **连接工具名称**。检测只读，不会自动写入。Claude 可选 Code / Desktop。已有配置时可点 **已配置，直接验证**。
2. **验证连接**：配置写入后自动进入此步。先在 AI 工具中重新加载 MCP 或新开会话，再点击 **复制验证提示词**，到 AI 对话粘贴发送。看到真实调用返回 `version: 1`、每批最多 `50` 条后，点 **我已验证，下一步**。这一步由你根据 AI 返回结果确认，应用不会把写入配置或服务自检当作连接成功。
3. **开始采集**：点击 **复制采集任务**，到 AI 对话修改目标岗位、城市和条件后发送。采集结果回到 OfferDesk 的待核对草稿，由你确认保存。

无法自动配置时，主按钮会改为 **复制 MCP 配置**（DSH 为 **复制 Cordis 补丁**），并展开 **手动配置与参数** 的三步说明。原始命令、参数和配置文件默认折叠，需要时再查看。

**写入只更新 OfferDesk 条目，保留其他服务器和模型设置，不会自动启动、重启 AI 工具或执行服务自检。** 配置若在检测后被其他程序修改，会停止写入；点击 **重新检测** 再试。未找到用户配置不代表客户端未安装，也可能使用了项目配置或自定义位置。

### 自动配置适用范围

| 工具 | 自动配置方式与条件 |
|---|---|
| Codex | 检测可直接运行的官方 Codex CLI，用 `codex mcp add` 注册用户级配置，并用 `mcp get` 回读；没有 CLI 时使用下面的表单方式 |
| Claude Code | 合并用户级 `~/.claude.json`；需先启动过客户端 |
| Claude Desktop | 合并本机 `claude_desktop_config.json`；需先启动过客户端 |
| WorkBuddy | 合并已存在的 `~/.workbuddy/mcp.json`；自定义位置使用手动方式 |
| ZCode | 合并已存在的用户配置目录中的 `config.json`，同时开启 `features.mcp` |
| OpenCode V2 | 优先通过官方 CLI 注册用户级配置；没有 CLI 时可合并现有用户目录中的标准 JSON 配置 |
| DSH | 需把 Cordis 补丁加载到指定会话，按下面的手动步骤操作 |

自动写入不处理包含注释的 JSON、格式错误、链接文件或多份有歧义的配置；会给出手动步骤。OpenCode 的 JSONC 可通过其官方 CLI 处理。工具尚未安装或未完成首次设置时，先打开工具再检测。检测与预览不会写入配置；写入失败不会启动或强制重启 AI 客户端。

## 手动配置

在工具卡片下展开 **手动配置与参数**，可逐项复制或编辑配置文件。

## Codex：按表单填写

在 AI 工具打开 **设置 → MCP 服务器 → 添加服务器**。IDE 扩展从齿轮菜单进入 MCP 设置。

| 表单项目 | 填什么 |
|---|---|
| 名称 | `offerdesk` |
| 类型 | **STDIO / 本地命令** |
| 启动命令 | 复制 OfferDesk 中的 **MCP 启动命令**，只填可执行文件路径 |
| 参数 | 点击“添加参数”，按 OfferDesk 显示的顺序**每项单独添加** |
| 环境变量 | 留空 |
| 环境变量传递 | 留空 |
| 工作目录 | 留空；若必填，复制 OfferDesk 中的 **MCP 工作目录** |

不要选流式 HTTP，不用填写 URL。不要把整段 JSON、数组括号或额外引号填进表单。AI 工具会自动启动 MCP 服务，无需自己在终端运行它。

**已安装的 macOS 应用示例**（安装在“应用程序”目录时）：

```text
启动命令：/Applications/OfferDesk.app/Contents/MacOS/OfferDesk
参数 1：--offerdesk-mcp
```

Windows 使用应用中生成的 `OfferDesk.exe` 绝对路径。源码运行时命令通常是 Electron，参数还包含项目路径；必须完整复制所有参数，不能只留下 `--offerdesk-mcp`。

保存后重启该 MCP 连接或客户端，在新对话输入 `/mcp`，查看 `offerdesk`。也可编辑 `~/.codex/config.toml`（Windows：`%USERPROFILE%\.codex\config.toml`），添加应用生成的 `[mcp_servers.offerdesk]` 段；**表单与文件配置任选一种**。已有同名段时更新该段，不重复添加。

## 其他工具：配置放在哪里

每个工具卡片内均有三步操作说明与对应配置。空配置文件可复制整段；已有配置时只合并 OfferDesk 条目，保留其他服务器和模型设置。

| 工具 | 配置位置与操作 | 保存后 |
|---|---|---|
| Claude Code | 当前项目根目录 `.mcp.json`，合并 `mcpServers.offerdesk` | 重新打开会话，在 `/mcp` 中查看并按需批准项目服务器 |
| Claude Desktop | 本地 MCP 开发者配置；旧版入口为 Settings → Developer → Edit Config。macOS 文件为 `~/Library/Application Support/Claude/claude_desktop_config.json`，Windows 为 `%APPDATA%\Claude\claude_desktop_config.json` | 完全退出再打开，从本地 MCP / Connectors 查看工具；不要在远程连接器里填网址 |
| WorkBuddy | 插件 → MCP 服务器 → 配置 MCP；部分版本在设置 → MCP。合并 `mcpServers.offerdesk` | 保存、启用 offerdesk，再重新连接或重启 |
| ZCode | `~/.zcode/cli/config.json`（Windows：`%USERPROFILE%\.zcode\cli\config.json`），或项目 `zcode.json`；合并 `mcp.servers.offerdesk`，保持 `features.mcp: true` | 重开会话，在 MCP 设置中查看 |
| OpenCode V2 | 当前项目 `opencode.json` / `opencode.jsonc`，合并 `mcp.servers.offerdesk` | 重启后用 `/mcps` 或 `opencode mcp list` 查看 |

WorkBuddy 等工具若要求逐项填写，可展开卡片下的 **STDIO 表单值**，按 Codex 表格的方法填写。

**DSH / DeepSeek Harness**：点击 DSH 卡片，复制 Cordis 补丁并保存为 `offerdesk.cordis.yml`。它是合法的 YAML 内容，不要改成通用 `mcpServers` JSON。运行以下命令，将引号中的路径替换为实际保存位置：

```sh
dsh web --patch "/绝对路径/offerdesk.cordis.yml"
```

已有补丁时合并 `insert` 条目。必须在加载了这个补丁的 DSH 会话里使用 OfferDesk 工具。

## 确认连接成功

在第二步点击 **复制验证提示词**，到已配置的 AI 工具中粘贴发送：

> 请只调用 OfferDesk 的 get_import_spec，告诉我返回的 version 和每批岗位上限。不要搜索岗位，也不要调用 import_jobs 或导入任何数据。如果找不到工具，请直接说明尚未连接。

成功应有**实际工具调用回执**，返回 `version: 1`、每批最多 50 条等信息。工具列表应包含 `get_import_spec` 和 `import_jobs`，名称可能带 OfferDesk 前缀。仅看到“配置已保存”或 AI 口头回复“已连接”，不算验证通过。

## 开始收集岗位

确认 AI 实际调用成功后，点击 **我已验证，下一步 → 复制采集任务**，修改岗位、城市和条件，再发给 AI：

> 请寻找杭州或上海的前端实习岗位。先调用 OfferDesk 的 get_import_spec 查看格式，再逐个打开岗位详情并展开完整正文，不只读取搜索摘要。保留来源链接、正文栏目与全部原文，逐项填写基本信息、薪资、学历、毕业年份、实习时长和每周到岗；将全部任职要求填入 required、全部加分/优先条件填入 preferred、完整出勤与到岗安排填入 availability，保留原句与限定条件。原文有写就填写，确认未写才留空，不编造、不把职责当要求、不自动投递。调用 import_jobs 导入待核对草稿，检查回执 warnings，最后告诉我成功、重复、失败各多少条和仍需核对的缺项。

回到 OfferDesk → **外部导入待核对 → 核对岗位 → 保存到岗位列表**。不合适的岗位可丢弃草稿。搜索和浏览网页由 AI 工具完成，MCP 本身负责导入。

### 避免要求漏填

`raw_text` 保存招聘原文，`fields` 保存结构化字段，两者都要填写。必备技能 `required` 包含全部任职要求（不限于技术词）；加分项 `preferred` 包含优先条件；到岗条件 `availability` 保留出勤天数、实习期限、到岗时间等完整原句，即使这些信息已填写到单独字段。

导入时，应用会从所提交正文中补充空字段和遗漏条目，支持常见中英文栏目及 Markdown 标题、列表。已有标量值保留，列表只追加未覆盖的内容；不会把职责、福利或推荐岗位混入要求。原文没有明确说明或存在歧义时保持为空，不编造。

回执的 `filled_fields` 表示应用补充过的栏目；`warnings` 提醒仍为空的要求或超过字段限制的内容，不代表导入失败。每类要求最多40项、单项2000字，技能标签最多15项，完整原文仍会保留；超出时应对照原文人工核对。

旧草稿或已保存岗位可点击 **从原文补全**，核对后保存。此操作只读取该条记录已保存的原文，不覆盖已填值，也不会自动访问原网页。若当初 AI 只保存了摘要，需重新读取完整网页，再人工补充；重复导入同一链接不会覆盖现有记录。更新应用后重连 MCP 或重开 AI 会话，以加载新的字段说明。

## 连接失败时

接入页底部的 **连接故障排查** 默认折叠，仅在需要时展开并点击 **自检 OfferDesk 服务**。该检查只验证 OfferDesk 自己的本机服务能否启动和响应，不检测 AI 工具是否打开或连接，也不会导入岗位。自检通过后仍以 AI 工具中的实际调用为准；正常接入无需执行这一步。

| 现象 | 优先检查 |
|---|---|
| 找不到程序 / ENOENT | 启动命令是否为真实可执行文件路径；应用是否被移动。重新从 OfferDesk 复制，路径含空格时也不额外加引号 |
| 配置保存了，但没有工具 | 是否启用 offerdesk、重启连接并新开会话；是否选了 STDIO；JSON 层级是否与所选工具匹配 |
| 只能填网址 | 这是远程 MCP 入口；请改用支持本地 STDIO 的 MCP 设置入口 |
| 检查通过，导入提示应用未打开 | 打开 OfferDesk 并等页面加载完成；源码环境或多副本使用各自生成的配置，不混用路径与参数 |
| AI 不会搜索网页 | 为该 AI 工具启用搜索或浏览器能力；OfferDesk 不提供搜索工具 |
| 超时，不确定是否导入 | 使用原 `batch_id` 和完全相同的内容重试，避免重复创建 |
| 部分岗位失败 | 按回执补齐字段，以新批次重试失败的条目 |

导入结果先成为草稿，不会自动投递。同一来源链接通常跳过重复记录；不同链接的同一岗位仍需人工核对。

配置依据：[Codex 官方 MCP 文档](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)、[Claude Code](https://code.claude.com/docs/en/mcp)、[Claude Desktop 本地 MCP](https://modelcontextprotocol.io/docs/develop/connect-local-servers)、[WorkBuddy](https://www.codebuddy.ai/docs/zh/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/MCP-Guide)、[DSH](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/mcp/mcp-client/README.md)、[OpenCode](https://opencode.ai/docs/mcp-servers/)。
