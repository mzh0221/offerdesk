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

不提交个人岗位、截图、密钥、依赖或安装包。源码采用 [MIT 许可证](LICENSE)，第三方组件保留原许可。

## 目录说明

| 目录 | 内容 |
|---|---|
| `desktop/` | 桌面进程、页面入口、MCP 接入与图标 |
| `components/` | React 交互界面 |
| `lib/` | 领域规则、OCR 解析与本地数据逻辑 |
| `tests/` | 单元测试与桌面回归测试 |
| `scripts/` | 构建资源准备脚本 |
| `docs/` | 当前需求、导入指南与构建说明 |
| `docs/archive/` | 历史检查与验证记录 |

`release/`、`test-results/`、`desktop/renderer-dist/`、`desktop/ocr-runtime/` 和 `*.tsbuildinfo` 均为可重新生成的本地产物，不提交 Git。`npm start` 会重新准备 OCR 资源并构建页面。

`local-data/` 和 `pngs/` 是忽略提交的本机资料目录，可能包含个人岗位与原始截图，不作为普通构建缓存删除。
