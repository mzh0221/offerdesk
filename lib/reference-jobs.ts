import { EMPTY_FIELDS, type Job } from './domain.ts';
import { ADDITIONAL_REFERENCE_JOBS } from './reference-jobs-additions.ts';

export const REFERENCE_CHECKED_AT = '2026-11-03';
export const REFERENCE_SEED_KEY = 'seed:yangtze-internships:2026-11-03:v1';

// Summaries of public employer postings. Missing terms remain null.
// Availability is not monitored; follow the source link before applying.
const INITIAL_REFERENCE_JOBS = [
    {
        ...EMPTY_FIELDS,
        key: 'xiaohongshu-backend-22682',
        company: '小红书',
        title: '【28届】后端实习生',
        city: '上海',
        job_type: '实习',
        education: '计算机、软件等相关专业在校生',
        graduation_year: '2028届',
        internship_duration: '至少3个月',
        days_per_week: '每周至少4天',
        tags: ['Java', 'Spring Boot', 'MySQL', 'Redis', 'Agent'],
        required: ['掌握一种后端语言及常见开发框架，了解数据库、缓存和消息组件的原理', '具备数据结构、算法及设计模式基础，对大模型和Agent有了解'],
        preferred: ['大三或研一及以上优先；有后端服务实践更佳', '可尽快到岗、连续实习超过4个月者优先'],
        availability: ['每周至少到岗4天，连续至少3个月'],
        source_url: 'https://job.xiaohongshu.com/campus/position/22682',
        source_note: '企业招聘站公开职位；薪资未说明。岗位标题标注28届。',
    },
    {
        ...EMPTY_FIELDS,
        key: 'xiaohongshu-baas-20526',
        company: '小红书',
        title: 'BaaS 平台研发实习生-存储&数据库部',
        city: '上海 / 杭州',
        job_type: '实习',
        internship_duration: '至少6个月',
        tags: ['Java', 'Go', 'Python', 'SQL', 'PostgreSQL'],
        required: ['熟练使用Go、Java、Python中的至少一种后端语言', '了解关系型数据库的SQL、索引与事务，具备团队沟通能力'],
        preferred: ['有PostgreSQL、容器或沙箱实践，了解RAG、工具调用等大模型应用', '熟悉Vue/React；有BaaS平台、AI编程工具或开源项目经验更佳'],
        availability: ['可连续实习至少6个月', '官网同时提供北京、上海、杭州地点；这里仅展示长三角选项，需投递时确认具体团队'],
        source_url: 'https://job.xiaohongshu.com/campus/intern/position/20526',
        source_note: '企业招聘站公开职位；薪资、学历、届别及每周到岗天数未说明。',
    },
    {
        ...EMPTY_FIELDS,
        key: 'hikvision-java-3dbc4346',
        company: '海康威视',
        title: '软件产品-Java开发实习生-杭州',
        city: '杭州',
        job_type: '实习',
        education: '本科及以上',
        tags: ['Java', 'Spring Boot', 'MyBatis', 'MySQL'],
        required: ['具备Java的IO、多线程、集合及面向对象基础，理解常见设计模式', '熟悉Spring MVC、Spring Boot、MyBatis等开发框架及关系型数据库', '具备团队协作和沟通能力'],
        preferred: ['计算机、软件、信息、通信、自动化等相关专业优先'],
        source_url: 'https://talent.hikvision.com/home/socity/position?postId=3DBC4346A3391150639BCB4895723F64',
        source_note: '企业官网发布日期2026-06-04，标题明确为实习；页面位于社招栏目，在校资格及到岗安排需向招聘方确认。薪资未说明。',
    },
    {
        ...EMPTY_FIELDS,
        key: 'bambulab-nlp-7685727997987555622',
        company: '拓竹科技',
        title: 'NLP / 大模型应用算法实习生',
        city: '杭州',
        job_type: '实习',
        education: '全日制统招本科及以上',
        internship_duration: '至少3个月',
        days_per_week: '每周至少4天',
        tags: ['Python', 'SQL', 'PyTorch', 'NLP', 'RAG'],
        required: ['具备机器学习、深度学习和NLP基础，了解搜索、召回及排序', '有模型训练或调参实践，熟悉Transformer、Embedding及大模型应用方法', '能用Python、SQL和至少一种深度学习框架进行数据处理、实验及评估'],
        preferred: ['计算机、AI、NLP、数学、统计等相关专业优先', '有搜索、推荐、语义检索、智能问答或大模型应用项目/实习经验'],
        availability: ['每周至少到岗4天，连续至少3个月'],
        source_url: 'https://bambulab.jobs.feishu.cn/experienced/m/position/7685727997987555622/detail',
        source_note: '企业招聘站公开实习职位；薪资及毕业届别未说明。此岗要求训练/调参基础，不只是调用模型API。',
    },
    {
        ...EMPTY_FIELDS,
        key: 'xiaoban-backend-intern',
        company: '小拌（杭州清度信息科技）',
        title: '后端开发实习生',
        city: '杭州',
        job_type: '实习',
        salary: '150–250元/天',
        education: '计算机相关专业本科及以上在读',
        internship_duration: '3–6个月，至少3个月',
        days_per_week: '每周至少4天',
        tags: ['Java', 'Spring Boot'],
        required: ['计算机相关专业在读，熟悉Java编程'],
        preferred: ['了解Spring Boot框架'],
        availability: ['连续至少3个月，每周至少到岗4天'],
        source_url: 'https://www.xiaobanapp.com/join',
        source_note: '品牌官网招聘页的“后端开发实习生”条目；官网列明日薪及邮箱投递入口，未标明发布日期或截止日期。',
    },
];

export const REFERENCE_BATCHES = [
    { key: REFERENCE_SEED_KEY, checkedAt: REFERENCE_CHECKED_AT, jobs: INITIAL_REFERENCE_JOBS },
    { key: 'seed:yangtze-internships:2026-11-04:v1', checkedAt: '2026-11-04', jobs: ADDITIONAL_REFERENCE_JOBS },
];
export const REFERENCE_JOBS = REFERENCE_BATCHES.flatMap(batch => batch.jobs);

export function referenceSeedBatches(now = new Date()) {
    const timestamp = now.toISOString();
    return REFERENCE_BATCHES.map(batch => ({ key: batch.key, rows: batch.jobs.map(({ key, source_note, ...fields }) => ({
        ...fields,
        id: `reference-${key}`,
        kind: 'job',
        import_id: null,
        status: '待投递' as const,
        applied_at: null,
        notes: `信息核查：${batch.checkedAt}。${source_note}\n岗位内容为公开招聘要求的摘要，是否仍接收申请以原招聘页为准。尚未代你投递。`,
        created_at: timestamp,
        updated_at: timestamp,
        is_reference: true,
        source_checked_at: batch.checkedAt,
    })) }));
}

export function referenceRows(now = new Date()): (Job & { kind: string; source_checked_at: string; is_reference: boolean })[] {
    return referenceSeedBatches(now).flatMap(batch => batch.rows);
}

type SeedRecord = { id: string; kind?: unknown; is_sample?: unknown; company?: unknown; title?: unknown };
export async function seedReferenceJobs(existing: SeedRecord[], put: (row: { id: string; kind: string }) => Promise<unknown>, remove: (id: string) => Promise<unknown>) {
    const ids = new Set(existing.map(row => row.id));
    // Each batch has its own marker: adding a batch must not restore deleted older jobs.
    for (const batch of referenceSeedBatches()) {
        if (ids.has(batch.key)) continue;
        for (const row of batch.rows) {
            if (!ids.has(row.id)) {
                await put(row);
                ids.add(row.id);
            }
        }
        for (const row of existing) {
            if (isLegacySample(row)) await remove(row.id);
        }
        await put({ id: batch.key, kind: 'meta' });
    }
}

// Only remove the original, identifiable fictional placeholders. Keep user records.
export function isLegacySample(row: { id: string; kind?: unknown; is_sample?: unknown; company?: unknown; title?: unknown }) {
    const originals = [
        ['示例 · 云杉科技', 'Java 后端开发实习生'],
        ['示例 · 序言软件', 'AI 应用开发实习生'],
        ['示例 · 北岸数据', '平台研发实习生'],
        ['示例 · 原点智造', '软件开发工程师'],
        ['示例 · 山海网络', '服务端开发实习生'],
    ];
    const index = originals.findIndex((_, i) => row.id === `demo-sample-${i}`);
    return index >= 0 && row.kind === 'job' && row.is_sample === true && row.company === originals[index][0] && row.title === originals[index][1];
}
