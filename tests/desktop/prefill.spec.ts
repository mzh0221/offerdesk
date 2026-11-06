import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('无标签手机版式预填、核对修改、保存与重启保留原文', async () => {
  const profile = await mkdtemp(path.join(tmpdir(), 'offerdesk-prefill-'));
  let app: ElectronApplication | undefined;
  const launch = async () => {
    app = await electron.launch({
      ...(process.env.OFFERDESK_TEST_EXECUTABLE ? { executablePath: process.env.OFFERDESK_TEST_EXECUTABLE } : {}),
      args: [...(process.env.OFFERDESK_TEST_EXECUTABLE ? [] : ['desktop']), `--user-data-dir=${profile}`],
    });
    const page = await app.firstWindow();
    await expect(page.getByRole('heading', { name: '岗位与投递', exact: true })).toBeVisible();
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
    await page.getByRole('button', { name: '文字录入', exact: true }).click();
    await page.getByLabel('招聘原文', { exact: true }).fill(raw);
    await page.getByRole('button', { name: '根据文字预填', exact: true }).click();
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
    await page.locator('.job-title-button').click();
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
