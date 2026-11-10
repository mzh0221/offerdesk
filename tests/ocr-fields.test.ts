import test from 'node:test';
import assert from 'node:assert/strict';
import { extractJobFields } from '../lib/ocr-fields.ts';

test('真实网页版式：档案不充当岗位，图标噪声不阻碍品牌名提取', () => {
  const fields = extractJobFields('阿里 健康\n[|\nAl 应 用 研发 实习 生 (Agent 方向 )\n杭州 校 招 2026/10/30\n岗位 职责\n参与产品开发\n岗位 档案 POSITION FILE\n企业 阿里健康');
  assert.equal(fields.company, '阿里健康');
  assert.equal(fields.title, 'AI 应用研发实习生(Agent 方向)');
  assert.equal(fields.job_type, '实习');
});

test('列表圆点OCR噪声、续行和多截图重复内容清理，不删除邮箱与账号', () => {
  const fields = extractJobFields(`任职要求
1. 基础条件
人 @ 本 科 及 以 上 在 读
2. 专业能力
@ Java 基础扎实：了解 Spring、Maven
等主流框架
人 @@ 动手能力：有项目经验
一 人 @ 高能动性：主动探索
联系方式
邮箱：developer@example.com
任职要求
@ Java 基础扎实：了解 Spring、Maven
等 主流 框架
@ 使用 user@example.com 配置通知
@alice
加分项
@@ 了解 RAG、MCP
Agent 工具调用
国际访问 切换国内线路`);
  assert.deepEqual(fields.required, ['本科及以上在读', 'Java 基础扎实:了解 Spring、Maven 等主流框架', '动手能力:有项目经验', '高能动性:主动探索', '使用 user@example.com 配置通知', '@alice']);
  assert.deepEqual(fields.preferred, ['了解 RAG、MCP Agent 工具调用']);
});

test('聚合页把职责放在任职要求栏目时，以内层任职要求为准', () => {
  const fields = extractJobFields(`REQUIREMENTS 具体 职责
任职 要求 根据业务需要与个人兴趣，参与以下方向
2. Al 基础 设施 建设
人 @ 参与编排内核、状态持久化
3. 服务与工程模块开发
@ 负责服务接口
任职 要求
1. 基础 条件
@ 本科及以上在读
2. 专业 能力
@ 掌握 Java
加分项
@ 有大模型应用经验`);
  assert.deepEqual(fields.required, ['本科及以上在读', '掌握 Java']);
  assert.deepEqual(fields.preferred, ['有大模型应用经验']);
});

test('招聘网页OCR中的导航、重复标题、品牌简称与中文空格', () => {
  const fields = extractJobFields(`offerseek.ai
人 offer 求索 首页 岗位聚合 投递工作台 岗位雷达 简历中心 登录
让每个人都能找到适合自己的机会
岗位 聚合 / AI 应用 研发 实习 生 (Agent 方向)
阿里 健康
[]
AI 应用 研发 实习 生 (Agent 方向)
杭州 校招 2026/10/30
岗位职责
参与智能体开发
任职要求
本 科 及 以 上 在 读，掌 握 Java 和 Spring Boot
了解 LangGraph、RAG、MCP
推荐职位
公司：其他科技
岗位：算法工程师`);
  assert.equal(fields.company, '阿里健康');
  assert.equal(fields.title, 'AI 应用研发实习生(Agent 方向)');
  assert.equal(fields.city, '杭州');
  assert.equal(fields.job_type, '实习');
  assert.equal(fields.education, '本科及以上在读');
  assert.equal(fields.salary, null);
  assert.ok(fields.tags.includes('Spring Boot'));
  assert.ok(fields.tags.includes('LangGraph'));
});

test('品牌简称推断需要标题与城市证据；正文和技术列表不作为公司', () => {
  assert.equal(extractJobFields('阿里健康\n只是介绍公司').company, '');
  assert.equal(extractJobFields('Java\n后端实习生\n杭州 校招').company, '');
  assert.equal(extractJobFields('offerseek.ai\n后端实习生\n杭州 校招').company, '');
  assert.equal(extractJobFields('岗位职责\n阿里 健康\n后端实习生\n杭州 校招').company, '');
  const explicit = extractJobFields('阿里健康\n开发实习生\n杭州 校招\n公司名称：明确公司');
  assert.equal(explicit.company, '明确公司');
});

test('字段值和条件中的中文空格归一化，英文技术词间隔保留', () => {
  const fields = extractJobFields('公司 名称：测试 科技\n岗位名称：后端 开发 实习 生\n工作地点：杭 州\n学历要求：本 科 及 以 上\n岗位类型：实 习\n任职要求\n掌 握 Spring Boot 和 Java');
  assert.equal(fields.company, '测试科技');
  assert.equal(fields.city, '杭州');
  assert.equal(fields.education, '本科及以上');
  assert.equal(fields.job_type, '实习');
  assert.ok(fields.required.includes('掌握 Spring Boot 和 Java'));
});

test('不同公司或岗位仍有歧义时留空；有明确类型时不覆盖', () => {
  assert.equal(extractJobFields('甲品牌\n后端实习生\n杭州\n乙品牌\n后端实习生\n上海').company, '');
  assert.equal(extractJobFields('阿里健康\n后端实习生\n前端实习生\n杭州').title, '');
  assert.equal(extractJobFields('开发实习生\n岗位类型：校招').job_type, '校招');
});

test('明确标签提取岗位，保留薪资单位、技能标签与要求分区', () => {
  const fields = extractJobFields('公司名称：示例科技\n职位名称：开发实习生\n工作地点：杭州\n薪资：200-300元/天\n学历要求：本科\n每周出勤：4天\n实习时长：3个月\n毕业年份：2027\n岗位类型：实习\n任职要求：\n1. 熟悉 TypeScript\n加分项：\n- 开源经验\n福利待遇：\n免费午餐');
  assert.equal(fields.company, '示例科技');
  assert.equal(fields.title, '开发实习生');
  assert.equal(fields.salary, '200-300元/天');
  assert.equal(fields.days_per_week, '4天');
  assert.deepEqual(fields.required, ['熟悉 TypeScript']);
  assert.deepEqual(fields.preferred, ['开源经验']);
  assert.deepEqual(fields.tags, ['TypeScript']);
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

test('手机招聘页无冒号头部：提取公司、职位、薪资、地点和学历', () => {
  const fields = extractJobFields(`示例科技有限公司
前端开发实习生
200-300元/天
杭州·滨江区 | 本科 | 实习
职位描述
负责日常页面开发，合作客户为上海其他网络有限公司
任职要求
1. 熟悉 TypeScript 和 React
2. 每周至少4天，连续实习3个月以上
加分项
有开源经验优先
公司介绍
北京总部为员工提供支持
推荐职位
Java工程师
30-50K`);
  assert.equal(fields.company, '示例科技有限公司');
  assert.equal(fields.title, '前端开发实习生');
  assert.equal(fields.salary, '200-300元/天');
  assert.equal(fields.city, '杭州');
  assert.equal(fields.education, '本科');
  assert.equal(fields.job_type, '实习');
  assert.equal(fields.days_per_week, '每周至少4天');
  assert.equal(fields.internship_duration, '实习3个月以上');
  assert.deepEqual(fields.required, ['熟悉 TypeScript 和 React', '每周至少4天,连续实习3个月以上']);
  assert.deepEqual(fields.preferred, ['有开源经验优先']);
  assert.deepEqual(fields.tags, ['TypeScript', 'React']);
  assert.equal(fields.availability.length, 1);
});

test('同一行多字段和 OCR 字间空格，不把后续字段塞进公司名', () => {
  const fields = extractJobFields('公 司 名 称：示例科技 | 岗 位 名 称：Java开发实习生\n工作地点：苏州；薪资：180元/天；学历要求：本科及以上');
  assert.equal(fields.company, '示例科技');
  assert.equal(fields.title, 'Java开发实习生');
  assert.equal(fields.city, '苏州');
  assert.equal(fields.salary, '180元/天');
  assert.equal(fields.education, '本科及以上');
  assert.equal(fields.job_type, '实习');
});

test('独立标签读取下一行，空标签不会吞掉下一个标签', () => {
  const fields = extractJobFields('公司名称\n示例软件\n岗位名称：\n测试实习生\n薪资\n工作地点\n宁波\n学历 本科');
  assert.equal(fields.company, '示例软件');
  assert.equal(fields.title, '测试实习生');
  assert.equal(fields.salary, null);
  assert.equal(fields.city, '宁波');
  assert.equal(fields.education, '本科');
});

test('标签没有冒号但用空格分隔，支持日薪、月薪的单位上下文', () => {
  const fields = extractJobFields('公司名称 示例科技\n招聘岗位 数据分析实习生\n日薪 200-300元\n任职资格 熟悉 SQL\n技能标签 Excel,Python');
  assert.equal(fields.company, '示例科技');
  assert.equal(fields.title, '数据分析实习生');
  assert.equal(fields.salary, '日薪 200-300元');
  assert.deepEqual(fields.required, ['熟悉 SQL']);
  assert.deepEqual(fields.tags, ['Excel', 'Python', 'SQL']);
});

test('明确字段优先于版式推断，多个明确值冲突时不使用推断兜底', () => {
  const fields = extractJobFields('示例科技\n开发实习生\n杭州 | 本科\n200-300元/天\n公司：甲\n公司名称：乙\n工作地点：上海\n薪资：250元/天\n学历要求：硕士');
  assert.equal(fields.company, '');
  assert.equal(fields.city, '上海');
  assert.equal(fields.salary, '250元/天');
  assert.equal(fields.education, '硕士');
});

test('头部多个岗位或多份薪资有歧义时留空，不靠位置随意挑选', () => {
  const fields = extractJobFields('示例科技\n后端开发实习生\n前端开发实习生\n150-200元/天\n200-300元/天\n杭州 | 上海');
  assert.equal(fields.title, '');
  assert.equal(fields.salary, null);
  assert.equal(fields.city, null);
});

test('职位描述、福利、公司介绍及推荐岗位不会成为岗位头部或要求', () => {
  const fields = extractJobFields('任职要求\n熟悉 Java\n工作职责\n负责 React 页面\n公司介绍\n示例科技有限公司\n产品经理\n上海 | 本科\n福利待遇\n每天餐补30元/天\n推荐职位\n测试实习生\n150元/天');
  assert.equal(fields.company, '');
  assert.equal(fields.title, '');
  assert.equal(fields.salary, null);
  assert.equal(fields.city, null);
  assert.equal(fields.education, null);
  assert.deepEqual(fields.required, ['熟悉 Java']);
  assert.deepEqual(fields.tags, ['Java']);
});

test('保留日薪、月薪、K范围及多薪制原文，不把人数或日期当薪资', () => {
  for (const salary of ['150-200元/天', '200-300/天', '20-30K·14薪', '20k-30k', '1.5-2万/月', '150元/日']) {
    assert.equal(extractJobFields(`软件工程师\n${salary}\n100-499人\n2026年11月5日`).salary, salary);
  }
  assert.equal(extractJobFields('示例科技\n100-499人\n2026年11月5日').salary, null);
});

test('从要求中提取学历、毕业届别、出勤与时长，优先条件不覆盖必备条件', () => {
  const fields = extractJobFields('岗位要求\n本科/硕士在读，2026/2027届\n每周3-5天，实习至少6个月\n加分项\n博士优先，每周5天，实习12个月');
  assert.equal(fields.education, '本科/硕士在读');
  assert.equal(fields.graduation_year, '2026/2027届');
  assert.equal(fields.days_per_week, '每周3-5天');
  assert.equal(fields.internship_duration, '实习至少6个月');
});

test('条件冲突时留空；明确无要求的否定文本不应变成条件或技能', () => {
  const fields = extractJobFields('岗位要求\n每周3天\n每周5天\n熟悉 JavaScript 和 Git\n无需 Java 或 Python 经验');
  assert.equal(fields.days_per_week, null);
  assert.deepEqual(fields.tags, ['JavaScript', 'Git']);
});

test('未知后续标签终止值，公司名不会混入联系方式', () => {
  const fields = extractJobFields('公司：示例科技 联系电话：123456\n岗位：开发实习生');
  assert.equal(fields.company, '示例科技');
});

test('同一行标题与薪资，仍保留岗位名称', () => {
  const fields = extractJobFields('示例科技\n前端开发实习生 | 200-300元/天\n杭州 | 本科');
  assert.equal(fields.title, '前端开发实习生');
  assert.equal(fields.salary, '200-300元/天');
});

test('不把否定要求变成确定条件；同句明确的正向条件仍可保留', () => {
  const fields = extractJobFields('岗位要求\n不要求本科，学历不限\n无需每周5天到岗\n不要求实习6个月\n不限制毕业届别');
  assert.equal(fields.education, '学历不限');
  assert.equal(fields.days_per_week, null);
  assert.equal(fields.internship_duration, null);
  assert.equal(fields.graduation_year, null);
});

test('空标签后出现薪资或操作按钮时不误填公司和岗位', () => {
  assert.equal(extractJobFields('公司名称\n200元/天').company, '');
  assert.equal(extractJobFields('岗位名称\n立即沟通').title, '');
});

test('只有职位描述大栏目时，根据明确要求语句分区，排除职责及公司介绍', () => {
  const fields = extractJobFields('示例科技\n算法实习\n职位描述\n1. 负责分析客户需求\n2. 本科及以上，熟悉 Python\n3. 每周4天，实习至少3个月\n4. 有 PyTorch 经验优先\n公司介绍\n公司具备 Java 开发能力，员工多数为硕士');
  assert.equal(fields.title, '算法实习');
  assert.equal(fields.education, '本科及以上');
  assert.equal(fields.days_per_week, '每周4天');
  assert.equal(fields.internship_duration, '实习至少3个月');
  assert.deepEqual(fields.required, ['本科及以上,熟悉 Python', '每周4天,实习至少3个月']);
  assert.deepEqual(fields.preferred, ['有 PyTorch 经验优先']);
  assert.deepEqual(fields.tags, ['Python', 'PyTorch']);
});

test('公司名中的学历词不当作要求，否定语句不影响后一句正向技能', () => {
  const fields = extractJobFields('博士科技有限公司\n后端开发实习生\n岗位要求\n无需Java经验，熟悉Python');
  assert.equal(fields.company, '博士科技有限公司');
  assert.equal(fields.education, null);
  assert.deepEqual(fields.tags, ['Python']);
});
