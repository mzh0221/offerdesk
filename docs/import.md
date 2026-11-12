# 用 AI 收集岗位

让 AI 找岗位，再导入 OfferDesk 核对保存。**导入时请保持 OfferDesk 打开。**

## 方式一：AI 自动导入

适用于 WorkBuddy、DeepSeek Harness、ZCode、Codex、Claude、Cursor 等支持本地 MCP 的工具。AI 工具和 OfferDesk 需在同一台电脑运行。

### 1. 连接 AI 工具

打开 OfferDesk → **AI 工具接入** → 选择你的工具 → **复制配置**。

按窗口中的提示，将配置添加到对应工具中，保留原有配置，然后重新加载或重启该工具。

常用工具的配置位置：

| 工具 | 配置位置 |
|---|---|
| WorkBuddy | 插件 → MCP 服务器 → 配置 MCP，或 `~/.workbuddy/mcp.json` |
| ZCode | `~/.zcode/cli/config.json` 或项目 `zcode.json` |
| Codex | MCP 设置或 `config.toml` |
| Cursor | MCP 设置中的 `mcp.json` |
| 其他工具 | 以 OfferDesk 窗口中的提示为准 |

**DeepSeek Harness（DSH）**：将复制的“Cordis 补丁”保存为 `offerdesk.cordis.yml`，再运行以下命令，把路径替换成实际位置：

```sh
dsh web --patch "/绝对路径/offerdesk.cordis.yml"
```

### 2. 让 AI 找岗位

把下面这段发给 AI，按需修改岗位、城市和条件：

> 请寻找杭州或上海的前端实习岗位。先调用 OfferDesk 的 get_import_spec 查看导入格式，再读取招聘详情，保留来源链接和原文，调用 import_jobs 导入待核对草稿。没有写明的信息留空，不编造、不自动投递。最后告诉我成功、重复和失败各多少条。

如果 AI 找不到 OfferDesk 工具，请先检查 MCP 连接状态。AI 需要自行具备搜索或浏览器能力。

### 3. 核对并保存

回到 OfferDesk → **外部导入待核对** → **核对岗位** → 检查字段 → **保存到岗位列表**。

不合适的岗位可以直接丢弃草稿。

## 方式二：导入 JSON 文件

适用于豆包工作，或无法连接本地 MCP 的 AI 工具。

1. 打开 OfferDesk → **AI 工具接入** → 选择 **豆包工作（JSON 文件导入）**。
2. 点击 **复制采集提示词**，发给 AI，并补充岗位、城市等条件，让它生成 `jobs.json`。
3. 下载文件，回到同一窗口点击 **选择岗位 JSON 文件**，再到待核对列表检查并保存。

AI 无法提供下载文件时，可以将它输出的完整 JSON 保存为 UTF-8 `.json` 文件后导入。每批最多 **50 条**，文件不超过 **4MB**。

豆包工作当前采用文件导入，不需要给它填写本地 MCP 配置。

## 遇到问题

| 问题 | 处理方法 |
|---|---|
| AI 找不到 OfferDesk 工具 | 检查配置是否保存，重新连接 MCP 或重启 AI 工具 |
| 提示 OfferDesk 未打开 | 打开应用，等岗位列表加载完成后重试 |
| 超时，不确定是否导入 | 让 AI 使用原 `batch_id` 和完全相同的内容重试 |
| 提示批次标识已使用 | 内容修改后要换一个新的 `batch_id` |
| 部分岗位导入失败 | 按错误提示补齐字段，再用新批次导入失败的条目 |
| 文件过大 | 让 AI 拆成多个批次，每批使用不同的 `batch_id` |
| AI 运行在云端或远程电脑 | 使用方式二，下载文件后在本机导入 |

导入结果会先成为草稿，不会自动投递。同一来源链接通常会跳过重复记录；不同链接的相同岗位仍需人工核对。

<details>
<summary>进阶：通过本机命令自动导入文件</summary>

有本机命令执行能力的 AI 工具，也可以直接调用 OfferDesk。先打开应用，将以下路径替换成实际位置。

macOS：

```sh
"/Applications/OfferDesk.app/Contents/MacOS/OfferDesk" --offerdesk-import "/绝对路径/jobs.json"
```

Windows PowerShell：

```powershell
& 'C:\Users\你的用户名\AppData\Local\Programs\OfferDesk\OfferDesk.exe' --offerdesk-import 'C:\路径\jobs.json'
```

成功时返回 JSON 回执，退出码为 0；失败时输出原因。也支持 `--offerdesk-import -` 从标准输入读取 JSON。

</details>
