# 补齐发行签名

更新日期：2026-11-05。维护者目前没有 Apple 开发者会员或 Windows 签名证书。**现有 v1.0.0 仍是未完成发行签名的预览版**，本文及工作流只是准备，不代表已经取得证书、通过审核或签名成功。

## Mac：需要先开通会员

1. 由维护者本人加入 [Apple Developer Program](https://developer.apple.com/programs/enroll/)，完成身份验证及会员购买。官方年费为99美元，本地价格以注册界面为准。普通免费 Apple 账号不足以申请用于公开分发的 Developer ID 证书。
2. 在自己的 Mac 上创建证书签名请求（CSR），在 Apple Developer 账号中申请 **Developer ID Application** 证书。将证书安装到生成 CSR 的钥匙串，确认同时存在对应私钥；不要误用 Apple Development 或 App Store 分发证书。
3. 从钥匙串导出包含私钥的 `.p12`，为导出文件设置密码，并把文件编码为 Base64。不要提交证书、私钥或密码到 Git，也不要发到聊天中。
4. 获取开发团队的 Team ID，并为 Apple 账号生成应用专用密码。此密码用于公证，不使用 Apple 账号的主登录密码。
5. 在仓库 **Settings → Secrets and variables → Actions → New repository secret** 配置以下五项：

| Secret 名称 | 内容 |
|---|---|
| `MAC_CSC_LINK` | 含私钥 `.p12` 文件的 Base64 内容 |
| `MAC_CSC_KEY_PASSWORD` | 导出 `.p12` 时设置的密码 |
| `APPLE_ID` | Apple 开发者账号邮箱 |
| `APPLE_APP_SPECIFIC_PASSWORD` | Apple 账号生成的应用专用密码 |
| `APPLE_TEAM_ID` | 开发团队 Team ID |

6. 在 GitHub Actions 手动运行 **Sign and notarize Mac apps**，选择 `main`。流程分别构建 arm64 / x64，对应用签名、公证并验证票据，再执行真实应用的截图和重启恢复测试。成功后下载名称以 `-signed` 结尾的工作流 artifact。
7. 第一次签名成功后，再准备新的已签名版本及发行说明。该流程不覆盖已发布的 v1.0.0，也不自动将签名产物替换到现有 Release。

项目已准备 `electron-builder.signed.mac.cjs` 和 `npm run desktop:sign:mac`。签名配置强制要求证书及公证凭据；缺失或签名、公证失败时流程终止，不会把未签名文件标成已签名。

普通 `desktop:dist` 与现有预览发布流程保持原样。只有明确选择签名流程时才读取签名凭据。当前尚无真实凭据，因此只验证了配置与缺失凭据的保护行为，未执行真实签名/公证。

参考：[Apple 会员注册与费用](https://developer.apple.com/help/account/membership/program-enrollment/)、[Developer ID](https://developer.apple.com/developer-id/)、[Electron 公证凭据](https://github.com/electron/notarize#usage-with-apple-id)。

## Windows：先申请开源签名服务

可申请 [SignPath Foundation](https://signpath.org/) 的免费开源签名服务。它要求项目使用符合条件的开源许可、公开维护、有可下载版本、可验证的构建流水线，以及多因素认证、签名策略与发布审批等要求。当前项目已有 MIT、源码和公开构建/Release，可作为申请材料的一部分，**是否接受由服务方审核决定**。

- 维护者本人阅读 [申请条件](https://signpath.org/terms.html)，确认愿意接受服务的证书与审批规则后提交申请；本项目尚未提交申请或获批。
- 如获批，服务方会提供组织/项目标识及签名策略，再按该策略接入 GitHub Actions。应验证最终 EXE 的 Authenticode 签名，再分发已签名文件及新校验和；若需要同时签名安装器内的主程序，应与服务方明确产物配置。
- 此方案不要求先购买个人证书；免费服务不能保证即时获批，也不能保证签名后所有新应用信誉提示立即消失。
- 付费 CA 证书是另一个选择，需核实申请主体、地区和云 HSM/硬件令牌支持。现代 Windows 代码签名证书通常不能简单当作可导出的 `.pfx` 上传给 CI。

本项目通过 GitHub 直接分发 EXE；改为 Microsoft Store 的 MSIX 分发是另一条需要单独设计的路径，当前没有切换分发渠道。

参考：[微软签名选项](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options)、[SignPath 官方 GitHub 集成](https://docs.signpath.io/trusted-build-systems/github)。
