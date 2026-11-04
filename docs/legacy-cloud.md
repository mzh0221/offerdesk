# 历史云服务方案（不属于当前需求）

2026-11-04：项目目标已改为单人、本机运行。以下内容仅记录现有云服务代码的原设计，Supabase、Vercel、账户邀请、RLS 和云端清理均不属于当前交付与验收要求。不要据此要求用户配置云服务或上线。

截图识别的本地运行方案尚待实现；下述通过云存储签名链接调用模型的流程不能直接用于当前本地模式。

## 原服务配置


### Supabase

1. 创建独立项目，在 SQL Editor 按文件名顺序执行 `supabase/migrations/` 中的迁移，每个文件只执行一次。已有项目仅执行尚未应用的迁移；`202611040001_fix_import_expiry.sql` 允许已保存导入永久保留，并修复旧约束导致未更新的已关联导入。
2. 将项目 URL、anon key、service role key 填入环境变量。service role 只供服务端签发上传凭证及清理文件，不写入前端。
3. Auth 配置关闭 **Allow new users to sign up**；由维护者在 Users 控制台邀请邮箱。这里采用邮件邀请，避免再维护一套邀请码系统。
4. Site URL 设置为实际网站地址，将 `http://localhost:3000/**` 和正式网站 `/auth/**`、`/login**` 添加到 Redirect URLs。
5. 配置自定义 SMTP。邀请邮件模板链接改为：

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite">接受邀请并设置密码</a>
```

密码恢复邮件模板链接改为：

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">重置密码</a>
```

6. 使用两个真实受邀测试用户，验证登录、密码设置、恢复、退出和数据隔离。

迁移创建私有 `screenshots` 存储桶，限制 MIME 和单图5MB。上传由服务端签发路径固定的令牌，用户不可任意覆盖图片。查看原图使用短期签名链接，获得链接的人在有效期内也能访问，因此不要转发原图链接。

### 图片模型

在阿里云百炼开通视觉模型，设置 `DASHSCOPE_API_KEY`。默认中国内地接口及 `qwen3-vl-plus` 非思考模式；若账号模型或区域不同，同时调整 `DASHSCOPE_BASE_URL`、`VISION_MODEL`。

识别请求将招聘截图通过短期签名链接交给模型服务。模型返回 JSON，Zod 校验后进入预览。公司、岗位必填，其余缺失值保留空，不换算薪资、不补写条件。没有文档解析、向量库、RAG 或 Agent。

每个用户每天20次、同时1次识别。原子额度与90秒租约在数据库函数中控制，模型请求45秒超时，失败请求也计入额度以控制成本。不会自动重试产生额外费用。链接有效期120秒。

### Vercel

1. 将源码推送到你自己的 Git 仓库，导入 Vercel，Framework 选 Next.js。如果仓库包含父目录，将 Root Directory 指向 `offerdesk`。
2. 正式环境设置 `APP_MODE=production`，配置 `.env.example` 中其余变量；不能只填本地 `.env.local`。
3. `CRON_SECRET` 使用随机长字符串。`vercel.json` 每天触发一次 `/api/cleanup`，清理到期的未保存导入和已删除岗位的截图。失败文件保留记录，下一次重试，每次最多处理50条。
4. 截图从浏览器直传 Supabase，不经过 Vercel 请求体；API 仅传文件元数据和记录ID。截图不会被内联为大体积Base64请求。
5. Supabase项目尽量靠近应用和模型的网络区域。必须在实际使用网络测试登录、直传和模型取图；此项目未假设境外托管在中国大陆网络下一定稳定。
6. 验证预览部署后发布正式环境。预览与正式应使用不同的 Supabase 项目与密钥，不向预览部署复制真实个人数据。


## 原云端数据和接口


`jobs` 保存结构化岗位和投递记录；`imports` 保存原文、识别状态及提取结果；`attachments` 关联私有截图；`usage_daily` 保存每日调用次数。日期按上海时区展示和计算，时间戳按UTC存储。

用户数据使用RLS；跨表关联同时约束记录ID和所属用户。所有API通过服务端会话识别用户，忽略请求中的 `user_id`。上传、查看、识别、保存、修改和删除都检查归属。

| 路径 | 方法 | 用途 |
|---|---|---|
| `/api/imports` | POST | 创建导入 |
| `/api/imports/:id/uploads` | POST | 签发1—5个受控上传凭证 |
| `/api/imports/:id/extract` | POST | 多图或文字识别，45秒超时 |
| `/api/imports/:id` | GET | 恢复导入 |
| `/api/jobs` | GET / POST | 分页筛选 / 确认保存 |
| `/api/jobs/:id` | GET / PATCH / DELETE | 详情 / 修改 / 删除 |
| `/api/attachments/:id` | GET | 原图短期签名链接 |
| `/api/cleanup` | GET | 仅定时任务Bearer凭据可调用 |

同一个导入只能关联一个岗位，重复保存返回原岗位。其他同名岗位提示后可以保留。日志只记录调用耗时、图片数和错误类型，不输出密钥和招聘原文。

