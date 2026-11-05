# OfferDesk · 岗位投递台

一个在本机运行的个人岗位与投递管理应用。收集招聘截图和原文，记录岗位要求、投递状态、日期和备注，数据保存在自己的电脑中。

源码采用 [MIT 许可证](LICENSE)，仓库为 [mzh0221/offerdesk](https://github.com/mzh0221/offerdesk)。

## 下载安装

从 [GitHub Releases](https://github.com/mzh0221/offerdesk/releases) 下载：

| 系统 | 文件 |
|---|---|
| Mac Apple Silicon（M 系列） | 名称含 `mac-arm64` 的 DMG 或 ZIP |
| Mac Intel | 名称含 `mac-x64` 的 DMG 或 ZIP |
| Windows x64 | 名称含 `win-x64` 的 EXE |

安装后直接打开，无需 Node.js、终端操作或账户。当前为未完成发行签名的预览版，系统可能提示开发者无法验证或阻止运行。

## 使用

- **录入**：选择、拖拽或粘贴同一岗位1—5张截图，或粘贴招聘文字，再手动填写岗位信息。
- **管理**：搜索和筛选岗位，修改投递状态、日期、备注及岗位详情，删除不再需要的记录。
- **核对**：查看保存的招聘原文、截图与原图，通过原链接打开招聘页面。
- **初始岗位**：附带20条公开实习岗位，详情保留来源与核查日期，是否仍接收申请以招聘方为准。数据更新不会覆盖用户修改或恢复已删除的旧岗位。

截图自动识别尚未实现；当前不要求数据备份或发行签名。

## 本地数据

岗位、原文和截图保存在应用独立目录中的 IndexedDB，正常关闭、重启后仍会保留。菜单“文件 → 打开数据目录”可查看位置：

- Mac：`~/Library/Application Support/OfferDesk/`
- Windows：`%APPDATA%/OfferDesk/`

清理项目源码、依赖或构建缓存不会清理应用数据。GitHub 保存程序代码和安装包，不存储个人岗位或截图。

## 从源码运行

需要 Node.js 22.18+。首次安装依赖和下载 Electron 运行时需要网络。

```sh
npm ci
npm start
```

`npm run dev` 和 `npm run desktop:start` 同样会生成页面并打开本地桌面窗口，无需配置环境变量。

## 检查与打包

```sh
npm test
npm run typecheck
npm run build
npm run desktop:test
npm run desktop:pack
npm run desktop:dist
```

安装包输出到 `release/`。GitHub Actions 在 Mac arm64、Mac x64 和 Windows x64 上分别构建并验证应用，所有平台通过后发布预览版与校验和。

## 项目结构

| 目录 | 用途 |
|---|---|
| `desktop/` | Electron 主进程、页面入口、样式和应用图标 |
| `components/` | 岗位列表、录入、详情与弹窗 |
| `lib/` | 本地存储、字段校验、岗位逻辑与初始数据 |
| `tests/` | 单元测试和桌面实际交互测试 |
| `.github/workflows/` | 项目检查及三平台安装包构建 |
| `docs/` | 当前需求、运行验证和岗位来源 |

详见 [当前需求](docs/requirements.md)、[桌面构建说明](docs/desktop.md)、[验证记录](docs/verification.md) 和 [贡献说明](CONTRIBUTING.md)。初始岗位来源见 [岗位资料](docs/reference-jobs.md)，相关名称与信息归原权利人所有。
