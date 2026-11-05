import test from 'node:test';
import assert from 'node:assert/strict';
import { extractJobFields } from '../lib/ocr-fields.ts';

test('仅从明确标签提取岗位，保留薪资单位与要求分区', () => {
  const fields = extractJobFields('公司名称：示例科技\n职位名称：开发实习生\n工作地点：杭州\n薪资：200-300元/天\n学历要求：本科\n每周出勤：4天\n实习时长：3个月\n毕业年份：2027\n岗位类型：实习\n任职要求：\n1. 熟悉 TypeScript\n加分项：\n- 开源经验\n福利待遇：\n免费午餐');
  assert.equal(fields.company, '示例科技');
  assert.equal(fields.title, '开发实习生');
  assert.equal(fields.salary, '200-300元/天');
  assert.equal(fields.days_per_week, '4天');
  assert.deepEqual(fields.required, ['熟悉 TypeScript']);
  assert.deepEqual(fields.preferred, ['开源经验']);
  assert.deepEqual(fields.tags, []);
});
test('缺失、冲突和无标签的内容不猜测', () => {
  const fields = extractJobFields('大厂急招开发\n城市：杭州\n工作地点：上海\n公司：甲\n公司名称：乙\n薪资面议');
  assert.equal(fields.company, '');
  assert.equal(fields.title, '');
  assert.equal(fields.city, null);
  assert.equal(fields.salary, null);
});
test('重复字段不冲突，独立调用不污染空表单', () => {
  assert.equal(extractJobFields('公司：甲\n公司：甲').company, '甲');
  extractJobFields('岗位要求：\n开发经验');
  assert.deepEqual(extractJobFields('').required, []);
});

test('同一行的明确要求可提取，其他栏目不混入要求', () => {
  const fields = extractJobFields('岗位要求：熟悉 Java\n加分项：开源经验\n联系方式：example@example.com\n招聘团队');
  assert.deepEqual(fields.required, ['熟悉 Java']);
  assert.deepEqual(fields.preferred, ['开源经验']);
});
