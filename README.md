# OfferDesk · 岗位投递台

以截图和文字为入口的个人求职工作台，用于收集岗位、核对要求和记录投递。**当前目标是 GitHub 开源的 Mac / Windows 本地桌面应用**：下载安装后直接打开，岗位和截图留在本机，不要求注册或云服务。

源码仓库：[mzh0221/offerdesk](https://github.com/mzh0221/offerdesk)。[v1.0.0 桌面预览版已发布](https://github.com/mzh0221/offerdesk/releases/tag/v1.0.0)，Mac arm64、Mac x64 和 Windows x64 均已在对应系统完成构建与打包后应用的重启恢复测试。

## 桌面版

| 系统 | 下载 |
|---|---|
| Mac Apple Silicon（M 系列） | [DMG 安装包](https://github.com/mzh0221/offerdesk/releases/download/v1.0.0/OfferDesk-1.0.0-mac-arm64.dmg) |
| Mac Intel | [DMG 安装包](https://github.com/mzh0221/offerdesk/releases/download/v1.0.0/OfferDesk-1.0.0-mac-x64.dmg) |
| Windows x64 | [EXE 安装包](https://github.com/mzh0221/offerdesk/releases/download/v1.0.0/OfferDesk-1.0.0-win-x64.exe) |

Mac 另有 ZIP 版本，所有文件及 [SHA-256 校验和](https://github.com/mzh0221/offerdesk/releases/download/v1.0.0/SHA256SUMS.txt) 见 Release 页面。

- 安装包自带运行环境，用户不需要 Node.js、终端或单独启动网页服务。
- 当前为预览版，尚未完成 Mac 签名/公证和 Windows 发行签名，系统可能提示开发者无法验证或阻止运行。截图自动识别、完整备份恢复和旧网页数据迁移尚未实现。

从源码打开桌面版：

```sh
npm ci
npm run desktop:start
```

桌面数据目录、打包与发行见 [桌面应用说明](docs/desktop.md)，需求与验收以 [当前需求](docs/requirements.md) 为准。

## 网页开发入口

需要 Node.js 22.18+。首次安装依赖需要可访问 npm 的网络。

```sh
npm ci
# 首次运行且没有 .env.local 时执行；已有配置请保留
cp .env.example .env.local
npm run dev -- --hostname 127.0.0.1
```

打开终端输出的地址，默认使用 `http://127.0.0.1:3000`。以后保持相同的协议、主机和端口访问：`localhost` 与 `127.0.0.1` 的浏览器存储相互独立，换地址不会自动迁移数据。停止服务可在终端按 `Ctrl+C`。

现有代码使用 `APP_MODE=demo` 启用本地存储，这是当前本地运行所用的配置值。无需 Supabase、账号登录、Vercel 或公网部署。

## 当前可用能力

- 岗位、导入记录和截图保存在本地 IndexedDB 中。桌面版使用应用独立数据目录，网页开发版使用当前浏览器的站点存储；刷新与重启后保留。
- 初始岗位共20条，整理自企业公开招聘信息，覆盖上海和杭州的实习，详情附来源及核查日期；是否仍接收申请以招聘方为准。初始状态统一为待投递。
- 新岗位批次追加时保留用户修改、自建岗位和已删除旧岗位的状态，刷新或重试不会重复新增。
- 支持文字录入，以及拖拽、选择或粘贴同岗位1—5张截图；截图可排序、移除，并通过手动填写保存岗位。
- 支持搜索、城市/状态/类型筛选、分页、岗位详情编辑、投递状态和日期管理、备注与删除。
- 桌面展示岗位表格与详情面板，窄屏展示岗位卡片和全屏详情；页面操作仍需完整人工验收。
- 当前标签页可“继续上次导入”；关闭标签页后不会自动恢复入口。退出导入时，尚未保存的人工修改不会持久化。

## 待完成的本地功能

- **数据备份与恢复**：当前尚无导出/导入功能，目标是完整备份岗位、投递记录、招聘原文和截图。Git 只管理代码，不会备份浏览器数据；清除网站数据、使用无痕模式或更换浏览器可能造成记录不可用。
- **截图自动识别**：功能目标保留，当前本地模式尚未接通模型，只能手动填写。在线模型与本机模型的选择待定；仅填写 `DASHSCOPE_API_KEY` 不会启用现有本地模式的识别功能。
- **完整本地验收**：新增、修改、删除、筛选、截图、刷新/重启后数据保留，以及错误恢复、键盘和窄屏操作。

本地运行不代表所有增强功能必须离线。基础岗位管理不依赖云服务；如后续选择在线识别，应用仍在本机运行，但识别需要网络，并应在调用前说明将发送的招聘文字和截图。

## 验证与维护

```sh
npm test
npm run typecheck
```

当前有23项单元测试，覆盖日期、状态、图片限制、搜索筛选、公开岗位增量、模型输出结构和危险链接等。`typecheck` 会先生成 Next.js 类型文件，无需手动先启动开发服务。桌面端实际窗口验证使用 `npm run desktop:test`。

需要本地构建时可运行 `npm run build`，然后使用 `npm run start -- --hostname 127.0.0.1`。构建是本地运行方式的选择，不要求公网发布；此前 Webpack 构建验证记录见验收文档。

- [当前需求](docs/requirements.md)：开源桌面应用的范围、功能目标和验收标准。
- [桌面应用与发行](docs/desktop.md)：平台、数据目录、构建与 GitHub Releases。
- [发行签名](docs/signing.md)：Mac 会员与证书申请、自动签名流程，以及 Windows 开源签名服务。
- [贡献说明](CONTRIBUTING.md)：开发与提交要求。
- [本地验收清单](docs/verification.md)：已完成检查和待验收事项。
- [初始岗位来源](docs/reference-jobs.md)：参考岗位与数据更新方式。
- [历史云服务方案](docs/legacy-cloud.md)：保留代码的历史说明，不属于当前交付要求。

源码采用 [MIT 许可证](LICENSE)，目标是在 GitHub 公开维护；初始岗位来自企业公开信息，来源及核查日期见岗位来源文档，相关名称与信息归原权利人所有。`.env.local`、依赖、构建缓存、安装包和测试数据已忽略，业务数据不进入 Git。
