import test from 'node:test';
import assert from 'node:assert/strict';
import { REFERENCE_JOBS, REFERENCE_BATCHES, referenceRows, referenceSeedBatches, seedReferenceJobs, isLegacySample } from '../lib/reference-jobs.ts';
import { jobSchema } from '../lib/schema.ts';

test('公开岗位均为长三角实习且保留独立来源和核查日期', () => {
    const rows = referenceRows(new Date('2026-11-03T12:00:00Z'));
    assert.equal(rows.length, 20);
    assert.equal(new Set(rows.map(row => row.id)).size, rows.length);
    for (const row of rows) {
        assert.equal(row.job_type, '实习');
        assert.ok(row.city?.split(' / ').every(city => ['上海', '杭州'].includes(city)));
        assert.ok(row.source_url?.startsWith('https://'));
        assert.ok(['2026-11-03', '2026-11-04'].includes(row.source_checked_at));
        assert.equal(jobSchema.safeParse(row).success, true);
        assert.equal(row.is_sample, undefined);
    }
});
test('真实岗位不生成虚构的投递或面试记录', () => {
    for (const row of referenceRows()) {
        assert.equal(row.status, '待投递');
        assert.equal(row.applied_at, null);
        assert.ok(row.notes.includes('尚未代你投递'));
    }
});
test('缺失薪资不使用行业平均或估算填充', () => {
    assert.equal(REFERENCE_JOBS.filter(row => row.salary === null).length, 19);
    assert.equal(REFERENCE_JOBS.find(row => row.key === 'xiaoban-backend-intern')?.salary, '150–250元/天');
});
test('增量批次各有独立标记与核查日期，岗位与来源不重复', () => {
    const batches = referenceSeedBatches();
    assert.deepEqual(batches.map(batch => batch.rows.length), [5, 15]);
    assert.equal(new Set(batches.map(batch => batch.key)).size, 2);
    assert.ok(batches[1].rows.every(row => row.source_checked_at === '2026-11-04'));
    assert.equal(new Set(REFERENCE_JOBS.map(row => row.source_url)).size, REFERENCE_JOBS.length);
});
test('旧数据库只追加新批次，保留改动、自建岗位及已删除的旧岗位', async () => {
    const [oldBatch, newBatch] = referenceSeedBatches();
    const edited = { ...oldBatch.rows[0], status: '面试', notes: '我的备注' };
    const custom = { id: 'my-job', kind: 'job', title: '自建岗位' };
    const records = new Map<string, any>([
        [oldBatch.key, { id: oldBatch.key, kind: 'meta' }], [edited.id, edited], [custom.id, custom],
    ]);
    const run = () => seedReferenceJobs([...records.values()], async row => { records.set(row.id, row); }, async id => { records.delete(id); });
    await run();
    assert.deepEqual(records.get(edited.id), edited);
    assert.deepEqual(records.get(custom.id), custom);
    assert.ok(!records.has(oldBatch.rows[1].id));
    assert.ok(newBatch.rows.every(row => records.has(row.id)));
    assert.ok(records.has(newBatch.key));
    records.delete(newBatch.rows[0].id);
    const size = records.size;
    await run();
    assert.equal(records.size, size);
    assert.ok(!records.has(newBatch.rows[0].id));
});
test('空库初始化20条，重复执行不新增；写入中断可重试', async () => {
    const records = new Map<string, any>();
    let writes = 0;
    const remove = async (id: string) => { records.delete(id); };
    await assert.rejects(seedReferenceJobs([], async row => {
        if (++writes === 3) throw new Error('storage full');
        records.set(row.id, row);
    }, remove));
    assert.ok(!records.has(REFERENCE_BATCHES[0].key));
    const run = () => seedReferenceJobs([...records.values()], async row => { records.set(row.id, row); }, remove);
    await run();
    assert.equal([...records.values()].filter(row => row.kind === 'job').length, 20);
    assert.equal(records.size, 22);
    await run();
    assert.equal(records.size, 22);
});
test('升级时只识别原始默认占位数据，保留用户新增及改名记录', () => {
    const old = { id: 'demo-sample-0', kind: 'job', is_sample: true, company: '示例 · 云杉科技', title: 'Java 后端开发实习生' };
    assert.equal(isLegacySample(old), true);
    assert.equal(isLegacySample({ ...old, id: 'my-job' }), false);
    assert.equal(isLegacySample({ ...old, company: '用户自己录入的公司' }), false);
    assert.equal(isLegacySample({ ...old, title: '用户修改后的岗位' }), false);
    assert.equal(isLegacySample({ ...old, is_sample: false }), false);
    assert.equal(isLegacySample({ ...old, kind: 'import' }), false);
});
test('参考岗位标识在不同刷新时间保持一致', () => {
    assert.deepEqual(referenceRows(new Date('2026-11-03')).map(row => row.id), referenceRows(new Date('2026-11-04')).map(row => row.id));
});
