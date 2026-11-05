# 参与 OfferDesk

本项目是单人使用的本地桌面应用，需求范围见 [docs/requirements.md](docs/requirements.md)。修改前请阅读仓库中的 `AGENTS.md` 及对应模块说明。

## 开发与检查

```sh
npm ci
npm run desktop:start
npm test
npm run typecheck
npm run desktop:test
```

桌面入口在 `desktop/`，共享界面在 `components/`，本地数据逻辑在 `lib/demo.ts`。网页开发可使用 `npm run dev -- --hostname 127.0.0.1`；安装包构建见 [docs/desktop.md](docs/desktop.md)。

涉及数据格式的改动应保留旧记录、用户修改及截图，并补充恢复测试。不要更改应用名、应用 ID 或内部来源，除非同时提供明确的数据迁移方案。核心功能必须能在未配置云服务时使用。

提交 PR 时说明用户可见变化与实际完成的验证。只改文档时检查链接与差异即可；不要把未运行的跨平台测试写成通过。

请勿提交 `.env.local`、访问令牌、证书、个人岗位数据、依赖目录或安装包。反馈问题时使用虚构样例，截图应去除个人信息。

源码按根目录 [MIT 许可证](LICENSE) 分发；第三方组件沿用各自许可，初始公开岗位的来源见 [docs/reference-jobs.md](docs/reference-jobs.md)。
