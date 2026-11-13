import { test } from 'node:test';
import assert from 'node:assert/strict';
import { externalBatchSchema, externalJobSchema, normalizeSourceUrl } from '../lib/external-import.ts';
import { completeJobFields } from '../lib/complete-fields.ts';
import { fieldsSchema } from '../lib/schema.ts';
import { EMPTY_FIELDS } from '../lib/domain.ts';
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

const fullText = `# 公司：示例科技
## 岗位：前端实习生
工作地点：杭州
薪资：200-300元/天
### **任职资格：**
1. 本科及以上在读，2027届
2. 熟悉 TypeScript 和 React
3. 有良好的沟通能力，不要求 Java 经验
### 【加分项】：
- 有开源项目经验优先
- 熟悉性能优化
### 到岗要求
每周至少4天，实习至少3个月
两周内到岗，线下办公
### 工作职责
负责页面开发，使用 Vue
### 福利待遇
免费午餐
### 推荐职位
公司：另一公司
岗位：Python工程师
任职要求
熟悉 Python`;

test('AI 仅提交公司和岗位时，从完整 Markdown 正文补齐全部条件和基本字段', () => {
    const parsed = externalJobSchema.parse({ ...job, raw_text: fullText });
    assert.deepEqual(parsed.fields.required, ['本科及以上在读,2027届', '熟悉 TypeScript 和 React', '有良好的沟通能力,不要求 Java 经验']);
    assert.deepEqual(parsed.fields.preferred, ['有开源项目经验优先', '熟悉性能优化']);
    assert.deepEqual(parsed.fields.availability, ['每周至少4天,实习至少3个月', '两周内到岗,线下办公']);
    assert.equal(parsed.fields.company, '公司');
    assert.equal(parsed.fields.title, '前端');
    assert.equal(parsed.fields.city, '杭州');
    assert.equal(parsed.fields.salary, '200-300元/天');
    assert.equal(parsed.fields.education, '本科及以上在读');
    assert.equal(parsed.fields.graduation_year, '2027届');
    assert.equal(parsed.fields.days_per_week, '每周至少4天');
    assert.equal(parsed.fields.internship_duration, '实习至少3个月');
    assert.equal(parsed.fields.job_type, '实习');
    assert.deepEqual(parsed.fields.tags, ['TypeScript', 'React']);
    assert.deepEqual(parsed.warnings, []);
    assert.ok(parsed.filled_fields.includes('required'));
    assert.equal(parsed.raw_text, fullText);
    assert.equal(fieldsSchema.safeParse(parsed.fields).success, true);
});

test('部分漏填也追加原文条目，保留人工字段和现有措辞；重复补全不会重复', () => {
    const current = { ...EMPTY_FIELDS, company: '人工公司', title: '人工岗位', city: '上海', salary: '面议', education: '硕士',
        required: ['熟悉 TypeScript 和 React（已核对）'], preferred: ['有开源项目经验优先'], availability: ['两周内到岗，线下办公'], tags: ['自定义'] };
    const completed = completeJobFields(current, fullText);
    assert.equal(completed.fields.city, '上海');
    assert.equal(completed.fields.education, '硕士');
    assert.equal(completed.fields.salary, '面议');
    assert.equal(completed.fields.required[0], current.required[0]);
    assert.equal(completed.fields.required.length, 3);
    assert.equal(completed.fields.preferred.length, 2);
    assert.equal(completed.fields.availability.length, 2);
    assert.ok(completed.fields.tags.includes('自定义'));
    assert.deepEqual(completeJobFields(completed.fields, fullText).fields, completed.fields);
    assert.deepEqual(current.required, ['熟悉 TypeScript 和 React（已核对）']);
    assert.deepEqual(completeJobFields(completed.fields, fullText).filledFields, []);
});

test('支持英文栏目、列表与到岗安排，职责和福利不混入要求', () => {
    const parsed = externalJobSchema.parse({ ...job, raw_text: `## Job Title: Software Intern
### Minimum Qualifications
- Strong TypeScript skills
- Communication skills
### Preferred Qualifications
- Experience with React
### Availability
- 4 days per week, starting in June
### Responsibilities
- Build Python services
### Benefits
- Free meals
### Related jobs
### Requirements
- Java experience` });
    assert.deepEqual(parsed.fields.required, ['Strong TypeScript skills', 'Communication skills']);
    assert.deepEqual(parsed.fields.preferred, ['Experience with React']);
    assert.deepEqual(parsed.fields.availability, ['4 days per week, starting in June']);
    assert.deepEqual(parsed.fields.tags, ['TypeScript', 'React']);
});

test('任职要求内的优先条件单独归入加分项，不提高成必备条件', () => {
    const parsed = externalJobSchema.parse({ ...job, raw_text: '任职条件\n熟悉 Python，有 PyTorch 项目经验优先\n每周4天，实习至少3个月\n入职要求\n一个月内到岗' });
    assert.deepEqual(parsed.fields.required, ['熟悉 Python', '每周4天,实习至少3个月']);
    assert.deepEqual(parsed.fields.preferred, ['有 PyTorch 项目经验优先']);
    assert.deepEqual(parsed.fields.availability, ['一个月内到岗', '每周4天,实习至少3个月']);
});

test('原文未说明或只有职责与福利时保持空白，给出需核对的回执', () => {
    for (const raw_text of ['岗位详情暂不可见', '岗位职责\n负责 React 页面开发\n福利待遇\n每周团队活动\n公司介绍\n熟悉 Java 的工程团队']) {
        const parsed = externalJobSchema.parse({ ...job, raw_text });
        assert.deepEqual(parsed.fields.required, []);
        assert.deepEqual(parsed.fields.preferred, []);
        assert.deepEqual(parsed.fields.availability, []);
        assert.equal(parsed.fields.salary, null);
        assert.ok(parsed.warnings[0].includes('完整招聘详情'));
    }
});

test('补全遵守数组及单项限制，超出时保留原文并警告，不使整条导入无效', () => {
    const raw_text = `任职要求\n${Array.from({ length: 42 }, (_, i) => `${i + 1}. 条件${i}`).join('\n')}\n加分项\n${'长'.repeat(2001)}`;
    const parsed = externalJobSchema.parse({ ...job, raw_text });
    assert.equal(parsed.fields.required.length, 40);
    assert.equal(parsed.fields.preferred.length, 0);
    assert.ok(parsed.warnings.some(w => w.includes('必备技能部分内容超过')));
    assert.ok(parsed.warnings.some(w => w.includes('加分项部分内容超过')));
    assert.equal(parsed.raw_text, raw_text);
    assert.equal(fieldsSchema.safeParse(parsed.fields).success, true);
});

test('技术标签去重不混淆 C# 和 C++；技能超过15项会提醒且仍可保存', () => {
    const similar = completeJobFields({ ...EMPTY_FIELDS, tags: ['JavaScript', 'NoSQL'] }, '岗位要求\n熟悉 Java 和 SQL');
    assert.deepEqual(similar.fields.tags, ['JavaScript', 'NoSQL', 'Java', 'SQL']);
    const parsed = externalJobSchema.parse({ ...job, raw_text: '岗位要求\n熟悉 C++、C#、Python、Java、JavaScript、TypeScript、Go、SQL、MySQL、Redis、Linux、Docker、React、Vue、Git、Excel、Figma' });
    assert.equal(parsed.fields.tags.length, 15);
    assert.ok(parsed.fields.tags.includes('C++'));
    assert.ok(parsed.fields.tags.includes('C#'));
    assert.ok(parsed.warnings.some(w => w.includes('技能标签部分内容超过')));
    assert.equal(fieldsSchema.safeParse(parsed.fields).success, true);
});

test('独立填写的每周出勤、实习时长也进入到岗条件，冲突值仍保留给人工核对', () => {
    const parsed = externalJobSchema.parse({ ...job, raw_text: '每周出勤：4天\n实习时长：至少3个月\n任职要求\n每周5天\n熟悉 SQL' });
    assert.equal(parsed.fields.days_per_week, '4天');
    assert.equal(parsed.fields.internship_duration, '至少3个月');
    assert.deepEqual(parsed.fields.availability, ['每周出勤: 4天', '实习时长: 至少3个月', '每周5天']);
});
