import test from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_FIELDS, STATUSES, filterJobs, nextAppliedDate, safeSourceUrl, splitCities, todayShanghai, validateImage, looksLikeImage, type Job } from '../lib/domain.ts';
test('投递日期使用上海时区，而非UTC日期', () => { assert.equal(todayShanghai(new Date('2026-11-03T20:00:00Z')), '2026-11-04'); });
test('首次投递填写日期，回退状态保留历史日期', () => { const now = new Date('2026-11-03T20:00:00Z'); assert.equal(nextAppliedDate(null, '待投递', now), null); assert.equal(nextAppliedDate(null, '面试', now), '2026-11-04'); assert.equal(nextAppliedDate('2026-10-22', '待投递', now), '2026-10-22'); });
test('全部投递状态都可以初始化日期', () => { for (const s of STATUSES)
    assert.equal(Boolean(nextAppliedDate(null, s)), s !== '待投递'); });
test('招聘链接拒绝javascript和data协议', () => { assert.equal(safeSourceUrl('javascript:alert(1)'), null); assert.equal(safeSourceUrl('data:text/html,hi'), null); assert.equal(safeSourceUrl('招聘网站'), null); assert.equal(safeSourceUrl(''), null); assert.equal(safeSourceUrl('https://example.com/job/1'), 'https://example.com/job/1'); });
test('图片限制包含格式、空文件和大小', () => { assert.equal(validateImage('image/png', 5 * 1024 * 1024), null); assert.ok(validateImage('image/png', 5 * 1024 * 1024 + 1)); assert.ok(validateImage('image/png', 0)); assert.ok(validateImage('image/svg+xml', 10)); assert.ok(validateImage('text/html', 10)); });
test('检查魔数拒绝伪装成图片的HTML', () => { const bytes = new TextEncoder().encode('<html>not a screenshot</html>'); assert.equal(looksLikeImage(bytes, 'image/png'), false); assert.equal(looksLikeImage(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), 'image/png'), true); assert.equal(looksLikeImage(new Uint8Array([255, 216, 255]), 'image/jpeg'), true); assert.equal(looksLikeImage(new TextEncoder().encode('RIFF0000WEBP'), 'image/webp'), true); });
const make = (id: string, override: Partial<Job> = {}): Job => ({ ...EMPTY_FIELDS, id, company: '云杉科技', title: 'Java后端', city: '杭州', tags: ['Spring Boot'], import_id: null, source_url: null, status: '待投递', applied_at: null, notes: '', created_at: '2026-11-01', updated_at: '2026-11-01', ...override });
test('多城市拆为独立选项，去除空白、空项和重复城市', () => {
    assert.deepEqual(splitCities(' 上海 / 杭州／上海、北京，深圳;; '), ['上海', '杭州', '北京', '深圳']);
    assert.deepEqual(splitCities(null), []);
    assert.deepEqual(splitCities(''), []);
});
test('多城市岗位归入每个城市筛选，使用完整城市名称匹配', () => {
    const jobs = [make('multi', { city: '上海 / 杭州', status: '面试' }), make('hangzhou'), make('shanghai', { city: '上海' }), make('unknown', { city: null })];
    assert.deepEqual(filterJobs(jobs, '', '杭州', '').map(j => j.id), ['multi', 'hangzhou']);
    assert.deepEqual(filterJobs(jobs, '', '上海', '').map(j => j.id), ['multi', 'shanghai']);
    assert.deepEqual(filterJobs(jobs, '', '杭州', '面试').map(j => j.id), ['multi']);
    assert.equal(filterJobs(jobs, '', '海', '').length, 0);
    assert.equal(filterJobs(jobs, '', '', '').length, 4);
});
test('公司、岗位和技能搜索忽略大小写', () => { const jobs = [make('a'), make('b', { company: '北岸', title: '数据开发', tags: ['SQL'] })]; assert.equal(filterJobs(jobs, 'spring', '', '').length, 1); assert.equal(filterJobs(jobs, '云杉', '', '').length, 1); assert.equal(filterJobs(jobs, 'JAVA', '', '').length, 1); assert.equal(filterJobs(jobs, '不存在', '', '').length, 0); });
test('多个筛选条件取交集，结果按最近更新排序', () => { const jobs = [make('a'), make('b', { updated_at: '2026-11-03', status: '面试' }), make('c', { city: '上海', status: '面试' })]; assert.deepEqual(filterJobs(jobs, '', '杭州', '面试').map(j => j.id), ['b']); assert.deepEqual(filterJobs(jobs, '', '', '').map(j => j.id), ['b', 'a', 'c']); assert.equal(filterJobs(jobs, '', '', '', '校招').length, 0); });
