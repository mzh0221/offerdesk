# 本地桌面应用与构建

## 架构

Electron 加载 Vite 编译的 React 页面，所有岗位和截图通过本地 IndexedDB 保存。应用固定使用 `offerdesk://app/`，不启动 HTTP 服务。

- `desktop/main.cjs`：应用窗口、菜单、数据目录与外部招聘链接。
- `desktop/policy.cjs`：内部资源路径与外链校验。
- `desktop/renderer/`：页面入口、截图原图页面及样式。
- `lib/local-store.ts`：本地岗位与截图存储。
- `lib/local-client.ts`：本地调用入口与图片校验。

页面启用沙箱、上下文隔离、CSP 和资源路径限制，不能访问 Node.js；招聘链接交给系统浏览器，截图原图在应用的隔离窗口打开。基础功能不发起远程请求。

## 数据目录与兼容

应用名、应用 ID、内部来源和数据库标识保持稳定，避免清理代码或升级时切换到空的数据空间。

- Mac：`~/Library/Application Support/OfferDesk/`
- Windows：`%APPDATA%/OfferDesk/`
- IndexedDB：`offerdesk-local-v1`，对象仓库 `records`。

应用数据位于源码目录之外，清理源码与构建目录不会删除岗位记录。Windows 卸载器配置为默认保留用户数据。导出/导入、跨设备同步不属于当前功能。

## 开发与构建

```sh
npm ci
npm start
npm test
npm run typecheck
npm run build
npm run desktop:test
npm run desktop:pack
npm run desktop:dist
```

`start` / `dev` 会先编译页面再打开 Electron 窗口。`build` 只生成 `desktop/renderer-dist/`；`desktop:pack` 生成应用目录；`desktop:dist` 在当前系统生成安装包，输出到 `release/`。

```sh
# 在对应架构的 Mac 上生成 DMG / ZIP
npm run desktop:dist -- --mac --arm64
npm run desktop:dist -- --mac --x64
# 在 Windows 上生成 EXE 安装器
npm run desktop:dist -- --win --x64
```

## 实际应用验证

`desktop:test` 在独立临时数据目录中启动真实窗口，验证岗位与截图保存、原图查看、状态和备注修改、退出重启及删除。不会操作个人现有数据。

- 用 `OFFERDESK_TEST_EXECUTABLE` 指向打包后的可执行文件，可验证实际应用包。
- 用 `OFFERDESK_UPGRADE_FROM` 指向受信任旧版本的 ASAR，可先由旧版本写入数据，再由当前版本读取，检查升级兼容。

## GitHub 分发

仓库为 `mzh0221/offerdesk`。`check.yml` 检查本地项目的测试、类型与构建；`desktop.yml` 在对应系统构建 Mac arm64、Mac x64 和 Windows x64 安装包，并启动打包后的应用进行同组验证。

推送 `v*` 标签且版本匹配后，所有平台通过才发布预览 Release。发布附 SHA-256 校验和及平台说明。当前不配置发行签名或自动更新，预览包可能被系统提示或拦截。
