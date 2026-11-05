# 参与 OfferDesk

项目是 Electron + React + Vite 本地桌面应用，当前范围见 [需求说明](docs/requirements.md)。

```sh
npm ci
npm start
npm test
npm run typecheck
npm run build
npm run desktop:test
```

桌面入口、样式和图标在 `desktop/`，界面在 `components/`，本地存储在 `lib/local-store.ts`，图片校验和本地调用在 `lib/local-client.ts`。打包见 [桌面构建说明](docs/desktop.md)。

保持应用名、应用 ID、内部来源、数据库名和对象仓库稳定。涉及存储格式时，应验证旧记录、投递状态、备注和截图仍可读取；不通过更改存储标识隐藏兼容问题。

当前不扩展云服务、网页账户、备份恢复或签名流程。PR 说明实际用户可见变化与已完成检查，未运行的平台验证不能写成通过。

不提交个人岗位、截图、密钥、依赖或安装包。源码采用 [MIT 许可证](LICENSE)，第三方组件保留原许可，初始岗位来源见 [岗位资料](docs/reference-jobs.md)。
