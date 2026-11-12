import { test } from 'node:test';
import assert from 'node:assert/strict';
import { externalBatchSchema, externalJobSchema, normalizeSourceUrl } from '../lib/external-import.ts';
const job = { source: '官网', source_url: 'https://example.com/jobs?id=1', raw_text: '公司招聘前端', fields: { company: '公司', title: '前端' } };
test('外部岗位字段默认值及必填校验', () => {
    const parsed = externalJobSchema.parse(job);
    assert.equal(parsed.fields.city, null); assert.deepEqual(parsed.fields.tags, []);
    for (const invalid of [{ ...job, source_url: 'file:///etc/passwd' }, { ...job, source_url: 'https://user:pass@example.com' }, { ...job, raw_text: '' }, { ...job, fields: { company: '公司' } }]) assert.equal(externalJobSchema.safeParse(invalid).success, false);
    assert.equal(externalBatchSchema.safeParse({ batch_id: 'x', jobs: Array(51).fill(job) }).success, false);
});
test('链接规范化保留岗位标识参数，只去除跟踪与片段', () => {
    assert.equal(normalizeSourceUrl('https://EXAMPLE.com/jobs?utm_source=ai&id=1#top'), 'https://example.com/jobs?id=1');
    assert.notEqual(normalizeSourceUrl('https://example.com/jobs?id=1'), normalizeSourceUrl('https://example.com/jobs?id=2'));
});
