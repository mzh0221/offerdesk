import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { addLegacyTextDraft } from './legacy-draft';
import { EMPTY_FIELDS } from '../../lib/domain';

test('旧文字草稿恢复：网页OCR空格与导航不阻碍品牌和标题预填，保存后保留原始文字', async () => {
  const profile = await mkdtemp(path.join(tmpdir(), 'offerdesk-web-prefill-'));
  const app = await electron.launch({
    ...(process.env.OFFERDESK_TEST_EXECUTABLE ? { executablePath: process.env.OFFERDESK_TEST_EXECUTABLE } : {}),
    args: [...(process.env.OFFERDESK_TEST_EXECUTABLE ? [] : ['desktop']), `--user-data-dir=${profile}`],
  });
  const raw = '首页 岗位聚合 投递工作台 简历中心 登录\n岗位 聚合 / AI 应用 研发 实习 生 (Agent 方向)\n阿里 健康\n[]\nAI 应用 研发 实习 生 (Agent 方向)\n杭州 校招 2026/10/30\n岗位职责\n参与 Agent 服务开发\n任职要求\n掌 握 Java 和 Spring Boot，了解 RAG 和 MCP';
  try {
    const page = await app.firstWindow();
    await addLegacyTextDraft(page, raw);
    await page.getByRole('button', { name: '继续上次导入', exact: true }).click();
    await expect(page.getByRole('button', { name: '返回', exact: true })).toHaveCount(0);
    await expect(page.getByLabel(/公司名称/)).toHaveValue('阿里健康');
    await expect(page.getByLabel(/岗位名称/)).toHaveValue('AI 应用研发实习生(Agent 方向)');
    await expect(page.getByRole('combobox', { name: /^岗位类型/ })).toHaveValue('实习');
    await expect(page.getByLabel('薪资原文', { exact: true })).toHaveValue('');
    await page.getByRole('button', { name: '保存到岗位列表', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.locator('.job-title-button:visible, .mobile-job-heading:visible').click();
    await page.getByText('原始招聘信息', { exact: false }).click();
    await expect(page.locator('pre')).toHaveText(raw);
  } finally {
    await Promise.all([app.waitForEvent('close'), app.evaluate(({ app }) => app.exit(0)).catch(() => {})]);
    await rm(profile, { recursive: true, force: true, maxRetries: 5 });
  }
});

test('旧 AI 草稿及已保存岗位可从原文补全，保留人工内容、取消修改与重启后的结果', async () => {
  const profile = await mkdtemp(path.join(tmpdir(), 'offerdesk-complete-fields-'));
  const launch = () => electron.launch({
    ...(process.env.OFFERDESK_TEST_EXECUTABLE ? { executablePath: process.env.OFFERDESK_TEST_EXECUTABLE } : {}),
    args: [...(process.env.OFFERDESK_TEST_EXECUTABLE ? [] : ['desktop']), `--user-data-dir=${profile}`],
  });
  let app = await launch();
  const raw = '工作地点：杭州\n薪资：200元/天\n## 任职要求\n熟悉 TypeScript 和 React\n有良好的沟通能力\n## 加分项\n有开源经验优先\n## 到岗条件\n每周至少4天，实习至少3个月';
  try {
    let page = await app.firstWindow();
    await expect(page.getByRole('heading', { name: '让 AI 帮你找机会', exact: true })).toBeVisible();
    await page.evaluate(({ raw, empty }) => new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('offerdesk-local-v1', 1);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result, tx = db.transaction('records', 'readwrite'), store = tx.objectStore('records');
        const fields = { ...empty, company: '旧版测试公司', title: '旧版测试岗位', city: '上海', required: ['人工核对的条件'], tags: ['自定义'] };
        const id = crypto.randomUUID(), savedId = crypto.randomUUID(), now = new Date().toISOString();
        store.put({ id, kind: 'import', input_type: 'text', state: 'review', step: 'review', raw_text: raw, extracted: fields, external_source: '旧版 AI', created_at: now, updated_at: now });
        store.put({ id: savedId, kind: 'import', input_type: 'text', state: 'saved', raw_text: raw, extracted: fields, created_at: now });
        store.put({ ...fields, id: 'job-' + savedId, import_id: savedId, kind: 'job', title: '已保存旧岗位', source_url: null, notes: '原有备注', status: '面试', applied_at: '2026-11-01', created_at: now, updated_at: now });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onabort = () => { db.close(); reject(tx.error); };
      };
    }), { raw, empty: EMPTY_FIELDS });
    await page.reload();
    await page.getByRole('button', { name: '核对岗位', exact: true }).click();
    await expect(page.getByLabel('加分项', { exact: true })).toHaveValue('');
    await page.getByRole('button', { name: '从原文补全', exact: true }).click();
    await expect(page.getByLabel('必备技能', { exact: true })).toHaveValue('人工核对的条件\n熟悉 TypeScript 和 React\n有良好的沟通能力');
    await expect(page.getByLabel('工作地点', { exact: true })).toHaveValue('上海');
    await expect(page.getByLabel('加分项', { exact: true })).toHaveValue('有开源经验优先');
    await page.getByRole('button', { name: '保存到岗位列表', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: '查看 已保存旧岗位 详情', exact: true }).click();
    await expect(page.locator('.requirement-list').filter({ hasText: '加分项' })).toContainText('未填写，请核对原文');
    await page.getByRole('button', { name: '从原文补全', exact: true }).click();
    await expect(page.getByLabel('加分项', { exact: true })).toHaveValue('有开源经验优先');
    await expect(page.getByLabel('工作地点', { exact: true })).toHaveValue('上海');
    await expect(page.getByLabel(/^个人备注/)).toHaveValue('原有备注');
    await page.getByRole('button', { name: '取消修改', exact: true }).click();
    await expect(page.locator('.requirement-list').filter({ hasText: '加分项' })).toContainText('未填写，请核对原文');
    await page.getByRole('button', { name: '从原文补全', exact: true }).click();
    await page.locator('.field-completion').screenshot({ path: test.info().outputPath('complete-fields.png'), animations: 'disabled' });
    await page.getByRole('button', { name: '保存修改', exact: true }).click();
    await expect(page.getByText('修改已保存', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '保存修改', exact: true })).toBeDisabled();
    await app.close(); app = await launch(); page = await app.firstWindow();
    await page.getByRole('button', { name: '查看 已保存旧岗位 详情', exact: true }).click();
    await expect(page.locator('.requirement-list').filter({ hasText: '必备技能' }).locator('li')).toHaveText(['人工核对的条件', '熟悉 TypeScript 和 React', '有良好的沟通能力']);
    await expect(page.locator('.requirement-list').filter({ hasText: '加分项' }).locator('li')).toHaveText(['有开源经验优先']);
    await expect(page.locator('.requirement-list').filter({ hasText: '到岗条件' }).locator('li')).toHaveText(['每周至少4天,实习至少3个月']);
    await expect(page.getByLabel('当前状态')).toHaveValue('面试');
    await expect(page.getByLabel('投递日期', { exact: true })).toHaveValue('2026-11-01');
    await page.getByText('原始招聘信息', { exact: false }).click();
    await expect(page.locator('pre')).toHaveText(raw);
  } finally {
    const child = app.process();
    if (child.exitCode === null) {
      const stopped = new Promise(resolve => child.once('exit', resolve));
      child.kill(); await stopped;
    }
    await rm(profile, { recursive: true, force: true, maxRetries: 5 });
  }
});

test('旧文字草稿恢复：无标签手机版式预填、核对修改、保存与重启保留原文', async () => {
  const profile = await mkdtemp(path.join(tmpdir(), 'offerdesk-prefill-'));
  let app: ElectronApplication | undefined;
  const launch = async () => {
    app = await electron.launch({
      ...(process.env.OFFERDESK_TEST_EXECUTABLE ? { executablePath: process.env.OFFERDESK_TEST_EXECUTABLE } : {}),
      args: [...(process.env.OFFERDESK_TEST_EXECUTABLE ? [] : ['desktop']), `--user-data-dir=${profile}`],
    });
    const page = await app.firstWindow();
    await expect(page.getByRole('heading', { name: '让 AI 帮你找机会', exact: true })).toBeVisible();
    return page;
  };
  const raw = `表单测试科技有限公司
前端开发实习生 | 200-300元/天
杭州·滨江区 | 本科 | 实习
职位描述
负责上海客户的前端开发
任职要求
熟悉 TypeScript、React
每周至少4天，实习至少3个月
加分项
有开源经验
公司介绍
北京公司为全国客户提供服务`;
  try {
    let page = await launch();
    await addLegacyTextDraft(page, raw);
    await page.getByRole('button', { name: '继续上次导入', exact: true }).click();
    await expect(page.getByRole('button', { name: '返回', exact: true })).toHaveCount(0);
    await expect(page.getByLabel(/公司名称/)).toHaveValue('表单测试科技有限公司');
    await expect(page.getByLabel(/岗位名称/)).toHaveValue('前端开发实习生');
    await expect(page.getByLabel('工作地点', { exact: true })).toHaveValue('杭州');
    await expect(page.getByLabel('薪资原文', { exact: true })).toHaveValue('200-300元/天');
    await expect(page.getByLabel('学历要求', { exact: true })).toHaveValue('本科');
    await expect(page.getByRole('combobox', { name: /^岗位类型/ })).toHaveValue('实习');
    await expect(page.getByLabel('每周到岗', { exact: true })).toHaveValue('每周至少4天');
    await expect(page.getByLabel('技能标签', { exact: true })).toHaveValue('TypeScript,React');
    await expect(page.getByLabel(/^加分项/)).toHaveValue('有开源经验');
    await page.getByLabel('工作地点', { exact: true }).fill('杭州/上海');
    await page.getByRole('button', { name: '保存到岗位列表', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await app!.close(); app = undefined;
    page = await launch();
    await page.getByLabel('搜索公司、岗位或技能').fill('表单测试科技');
    await page.locator('.job-title-button:visible, .mobile-job-heading:visible').click();
    await page.getByRole('button', { name: '编辑信息', exact: true }).click();
    await expect(page.getByLabel('工作地点', { exact: true })).toHaveValue('杭州/上海');
    await expect(page.getByLabel('技能标签', { exact: true })).toHaveValue('TypeScript,React');
    await page.getByText('原始招聘信息', { exact: false }).click();
    await expect(page.locator('pre')).toHaveText(raw);
  } finally {
    await app?.close();
    await rm(profile, { recursive: true, force: true });
  }
});
