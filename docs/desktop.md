# 桌面应用与发行

## 当前架构

桌面版使用 Electron + Vite，直接复用现有 React 工作台、岗位逻辑和 IndexedDB 存储。打包时只包含桌面主进程与编译后的页面，不运行 Next.js 服务、不监听 HTTP 端口，也不需要用户安装 Node.js。Next.js 入口保留用于网页开发。

主界面固定来源为 `offerdesk://app/`，启用渲染进程沙箱和上下文隔离，关闭 Node.js 集成。当前基础功能不发起远程请求，招聘链接在系统默认浏览器打开；截图原图在独立的隔离窗口查看。未来接入模型时需单独设计授权、密钥存储和网络策略。

Vite 不读取 `.env.local`；桌面包不包含服务端代码、Supabase 运行环境、开发依赖、浏览器用户数据或本地密钥。初始公开岗位数据属于项目参考内容，所有安装都会使用相同的初始岗位。

## 数据保存与迁移

菜单“文件 → 打开数据目录”可定位当前应用数据。默认位置：

- macOS：`~/Library/Application Support/OfferDesk/`
- Windows：`%APPDATA%/OfferDesk/`

保持应用名、应用 ID 和内部来源稳定，以便覆盖升级时继续读取记录。Windows 安装器默认不删除用户数据目录。网页浏览器中的旧记录与桌面版互相独立，不会自动迁移。

当前完整导出/导入尚未实现；不要删除数据目录。开发和自动测试使用临时独立配置，不操作用户现有岗位数据。

## 从源码运行

需要 Node.js 22.18+ 和 npm。首次执行桌面命令时会从 Electron 官方源下载运行时。

```sh
npm ci
npm run desktop:start
```

`desktop:start` 先生成页面，再打开桌面窗口，不依赖 `npm run dev`。

## 测试与打包

```sh
npm test
npm run typecheck
npm run desktop:test
npm run desktop:pack
npm run desktop:dist
```

- `desktop:test`：在临时数据目录中运行实际 Electron 窗口，检查离线页面、新建截图岗位、投递记录、截图显示与完全退出后的恢复。
- `desktop:pack`：生成可直接运行的应用目录。
- `desktop:dist`：在当前系统生成安装包，输出到 `release/`。

显式平台命令：

```sh
# 在相应架构的 Mac 上生成 DMG 和 ZIP
npm run desktop:dist -- --mac --arm64
npm run desktop:dist -- --mac --x64
# 在 Windows 上生成安装器
npm run desktop:dist -- --win --x64
```

可通过 `OFFERDESK_TEST_EXECUTABLE` 指向打包后的可执行文件，再运行 `npx playwright test --config playwright.desktop.config.ts` 验证安装包内容，而不是只测试源码入口。不要使用该变量指向未知程序。

## GitHub 发行流程

目标仓库为 `mzh0221/offerdesk`。`.github/workflows/desktop.yml` 支持手动触发，也在 `v*` 标签推送后运行：

1. Mac arm64、Mac x64、Windows x64 分别在原生 runner 上安装依赖并执行单元测试、类型检查和桌面交互测试。
2. 构建对应安装包，然后启动打包后的应用再次验证。
3. 将 DMG/ZIP/EXE 上传到 Actions artifacts。标签构建全部通过后，发布附校验和、明确标记为预览版的 Release。任一平台构建或测试失败时不发布。

2026-11-05：[v1.0.0 预览版](https://github.com/mzh0221/offerdesk/releases/tag/v1.0.0) 已公开发布。Mac arm64、Mac x64 和 Windows x64 三个平台均完成原生构建，并通过源码入口及打包后应用的截图保存、原图查看、投递记录和完全退出重启恢复测试；[构建结果](https://github.com/mzh0221/offerdesk/actions/runs/41957562246) 全部成功。Windows 安装向导、卸载及覆盖升级的人工验收尚未完成。

## 签名与预览状态

当前没有配置 Apple Developer 证书、公证凭据或 Windows 代码签名证书。首批产物是未完成发行签名的预览版，系统可能提示开发者无法验证或阻止运行。正式面向普通用户分发前，需完成 Mac 签名/公证与 Windows 签名方案；证书只配置为 CI secrets，不能提交到仓库。不要求购买证书才能阅读源码或本地开发。

自动更新暂未实现，初期从 Releases 下载新版本并覆盖安装。备份恢复、网页旧数据迁移和真实截图识别仍为后续功能，不能宣称已具备。

参考：[Electron 安全指南](https://www.electronjs.org/docs/latest/tutorial/security)、[自定义协议与存储](https://www.electronjs.org/docs/latest/api/protocol)、[electron-builder 配置](https://www.electron.build/v26/docs/configuration/)。
