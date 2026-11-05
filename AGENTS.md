# OfferDesk 项目约定

这是使用 Electron、React 和 Vite 的本地桌面应用，支持 Mac 与 Windows。当前范围以 `docs/requirements.md` 为准。

- 保留单人、本机运行与本地 IndexedDB 存储，不增加网页登录、云端账户、数据库、存储或网站部署。
- 数据保存在应用目录。不要改动应用名 OfferDesk、应用 ID、内部来源 offerdesk://app、数据库名 offerdesk-local-v1 或 records 对象仓库，除非同时提供并验证迁移方案。
- 用户当前不要求备份恢复、跨设备同步或发行签名，不将其作为必做项；新增需求以用户明确指示为准。
- 桌面页面不得获得 Node.js 权限。保留 sandbox、contextIsolation、CSP、协议资源路径限制与外链处理。
- `desktop/` 放桌面主进程和页面入口，`components/` 放交互界面，`lib/local-store.ts` 放本地数据逻辑，`lib/local-client.ts` 放文件校验与本地调用入口。
- 修改后运行与变更相关的检查：`npm test`、`npm run typecheck`、`npm run build`。涉及界面或存储时运行 `npm run desktop:test`；涉及打包时验证打包后的应用。
- 不提交依赖、构建产物、用户数据、密钥或证书。项目在 GitHub 开源，安装包由对应系统的 Actions runner 构建。
