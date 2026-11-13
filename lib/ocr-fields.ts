import { EMPTY_FIELDS, type Fields } from './domain.ts';

type Scalar = Exclude<keyof Fields, 'required' | 'preferred' | 'availability' | 'tags'>;
type Section = 'required' | 'preferred' | 'availability' | 'tags';
const LABELS: Record<string, Scalar> = {
  公司: 'company', 公司名称: 'company', 企业: 'company', 企业名称: 'company', 招聘公司: 'company', 所属公司: 'company', 用人单位: 'company',
  岗位: 'title', 岗位名称: 'title', 职位: 'title', 职位名称: 'title', 招聘岗位: 'title', 招聘职位: 'title',
  城市: 'city', 工作城市: 'city', 工作地点: 'city', 工作地址: 'city', 办公地点: 'city',
  薪资: 'salary', 薪酬: 'salary', 薪资待遇: 'salary', 薪资范围: 'salary', 工资待遇: 'salary', 日薪: 'salary', 月薪: 'salary',
  学历: 'education', 学历要求: 'education', 最低学历: 'education',
  毕业年份: 'graduation_year', 毕业时间: 'graduation_year', 毕业届别: 'graduation_year', 面向届别: 'graduation_year',
  实习时长: 'internship_duration', 实习时间: 'internship_duration', 实习周期: 'internship_duration', 实习期限: 'internship_duration',
  每周天数: 'days_per_week', 每周出勤: 'days_per_week', 每周到岗: 'days_per_week', 每周工作天数: 'days_per_week',
  岗位类型: 'job_type', 职位类型: 'job_type', 招聘类型: 'job_type',
  company: 'company', 'company name': 'company', 'job title': 'title', position: 'title',
  location: 'city', salary: 'salary', education: 'education', 'graduation year': 'graduation_year',
  'internship duration': 'internship_duration', 'days per week': 'days_per_week', 'job type': 'job_type',
};
const SECTIONS: Record<string, Section> = {
  任职要求: 'required', 岗位要求: 'required', 任职资格: 'required', 职位要求: 'required', 招聘要求: 'required', 必备技能: 'required', 技能要求: 'required', 技术栈: 'required', 工作要求: 'required', 岗位需求: 'required',
  加分项: 'preferred', 优先条件: 'preferred', 优先考虑: 'preferred',
  到岗条件: 'availability', 到岗要求: 'availability', 出勤要求: 'availability',
  任职条件: 'required', 资格要求: 'required', 任职需求: 'required', 应聘要求: 'required', 基本要求: 'required', 基本条件: 'required', 必要条件: 'required', 招聘条件: 'required',
  加分条件: 'preferred', 加分技能: 'preferred', 优先项: 'preferred', 优先要求: 'preferred', 优先资格: 'preferred',
  实习要求: 'required', 出勤安排: 'availability', 入职要求: 'availability', 实习安排: 'availability', 到岗时间: 'availability', 入职时间: 'availability',
  requirements: 'required', qualifications: 'required', 'minimum qualifications': 'required', 'basic qualifications': 'required', 'what you bring': 'required',
  'preferred qualifications': 'preferred', 'nice to have': 'preferred', 'nice-to-have': 'preferred', 'bonus points': 'preferred',
  availability: 'availability', 'start date': 'availability', 'internship requirements': 'availability',
  技能标签: 'tags', 岗位标签: 'tags',
};
const STOPS = ['岗位职责', '工作职责', '职位职责', '职位描述', '岗位描述', '工作内容', '公司介绍', '公司简介', '关于我们', '福利待遇', '职位福利', '联系方式', '联系人', '招聘流程', '投递方式', '推荐职位', '相似职位', '其他职位', '你可能感兴趣', 'responsibilities', 'what you will do', 'job description', 'about us', 'benefits', 'contact', 'how to apply', 'related jobs', 'similar jobs'];
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const compact = (value: string) => value.replace(/\s/g, '');
const names = [...Object.keys(LABELS), ...Object.keys(SECTIONS), ...STOPS].sort((a, b) => b.length - a.length);
const labelPattern = names.map(name => [...name].map(escape).join('\\s*')).join('|');
const cityNames = '北京|上海|天津|重庆|杭州|宁波|温州|嘉兴|湖州|绍兴|金华|台州|丽水|衢州|舟山|南京|苏州|无锡|常州|南通|镇江|扬州|徐州|合肥|芜湖|广州|深圳|珠海|佛山|东莞|惠州|中山|成都|武汉|西安|长沙|郑州|济南|青岛|厦门|福州|泉州|大连|沈阳|长春|哈尔滨|石家庄|太原|南昌|南宁|昆明|贵阳|海口|三亚|兰州|银川|西宁|乌鲁木齐|呼和浩特|拉萨';
const cityPattern = new RegExp(`^(?:${cityNames})(?:市)?(?=$|[\\s·/、-]|[\\p{Script=Han}]{1,12}(?:区|县|路|街))`, 'u');
const salaryPattern = /(?:[¥￥]\s*)?\d+(?:\.\d+)?\s*(?:(?:[kK]|万(?:元)?)?\s*[-—–~至]\s*\d+(?:\.\d+)?)?\s*(?:[kK](?:\s*\/\s*月)?|万(?:元)?(?:\s*\/\s*月)?|(?:元)?\s*\/\s*(?:天|日|月|小时|时)|元\s*[／/]?\s*(?:天|日|月|小时))(?:\s*[·x×*]\s*\d{1,2}薪)?/g;
const educationPattern = /(?:大专|本科|硕士|博士|研究生)(?:\s*[/、或]\s*(?:大专|本科|硕士|博士|研究生))*(?:及以上|以上)?(?:在读)?|学历不限|不限学历/g;
const skills: [string, string][] = [
  ['TypeScript', 'TypeScript'], ['JavaScript', 'JavaScript'], ['Java', 'Java'], ['Python', 'Python'], ['C\\+\\+', 'C++'], ['C#', 'C#'],
  ['Golang|Go', 'Go'], ['SQL', 'SQL'], ['MySQL', 'MySQL'], ['PostgreSQL', 'PostgreSQL'], ['Redis', 'Redis'], ['Linux', 'Linux'],
  ['Docker', 'Docker'], ['Kubernetes|K8s', 'Kubernetes'], ['React(?:\\.js)?', 'React'], ['Vue(?:\\.js)?', 'Vue'], ['Node\\.?js', 'Node.js'],
  ['Spring\\s*Boot', 'Spring Boot'], ['PyTorch', 'PyTorch'], ['TensorFlow', 'TensorFlow'], ['Git', 'Git'], ['Excel', 'Excel'], ['Figma', 'Figma'], ['Axure', 'Axure'],
  ['LangChain', 'LangChain'], ['LangGraph', 'LangGraph'], ['RAG', 'RAG'], ['MCP', 'MCP'], ['FastAPI', 'FastAPI'], ['Agent', 'Agent'],
  ['Spring(?!\\s*Boot)', 'Spring'], ['Maven', 'Maven'],
];
// Normalize a derived parsing copy only; keep the editable OCR original untouched.
function joinChinese(value: string) { return value.replace(/([\p{Script=Han}])\s+(?=[\p{Script=Han}])/gu, '$1'); }
function headerText(value: string) { return joinChinese(value).replace(/\s+\(/g, '(').replace(/\(\s+|\s+\)/g, m => m.trim()); }
function navigation(value: string) {
  const text = compact(value);
  return /^(?:岗位聚合|职位聚合|首页)\s*[/／>›]/.test(text)
    || /^(?:岗位档案|职位档案)(?:POSITIONFILE)?$/i.test(text)
    || /^(?:[\[\]|¦Il\s]+)$/.test(value)
    || /^(?:上旦|田[~～])/.test(text)
    || /国际访问.*切换国内线路|^(?:发布|更新)日期\d|^申请截止|登录后前往企业官方投递/.test(text)
    || /^(?:https?:\/\/|www\.)/i.test(text)
    || /^(?:[a-z0-9-]+\.)+(?:com|cn|ai|org|net)(?:[/:\s]|$)/i.test(value)
    || (text.match(/首页|岗位聚合|职位聚合|投递工作台|简历中心|岗位雷达|登录/g)?.length || 0) >= 2
    || /^(?:登录后去投递|立即投递|收藏|分享|返回|让每个人都能找到适合自己的机会|\[\]|\[I\])$/.test(text);
}
function titleText(value: string) {
  const title = clean(headerText(value).replace(salaryPattern, ''));
  return title.length <= 70 && /(?:工程师|实习生|实习岗|实习|开发|测试|设计师|分析师|产品经理|运营|助理|专员|研究员|管培生)(?:\([^()]{1,30}\))?$/.test(title)
    && !/[。:;|/]|急招|诚聘|招聘|熟悉|负责|要求|优先|经验|学历|本科|硕士|博士/.test(title) ? title : null;
}
const metadataCity = new RegExp(`^(?:${cityNames})(?:市)?(?=实习|校招|社招|本科|硕士|博士|20\\d{2}|$)`);
function metadata(value: string) {
  return !!compact(value).match(metadataCity) || /^(?:实习|校招|社招|本科|硕士|博士)(?:\s|\||$)/.test(value);
}
function clean(value: string) { return value.trim().replace(/^[|;,\s]+|[|;,\s]+$/g, ''); }
function bullet(value: string) {
  return value.replace(/^(?:[-•·●○▪◆]|\d+[.)、](?!\d)|(?:[一人小生全侠]\s*)*@+(?=\s|\p{Script=Han}))\s*/u, '').trim();
}
function heading(value: string) {
  const key = value.replace(/:$/, '').replace(/^[【\[]|[】\]]$/g, '').trim().toLowerCase();
  return /[a-z]/.test(key) ? key : compact(key);
}
function isHeading(value: string) { const key = heading(value); return key in LABELS || key in SECTIONS || STOPS.includes(key); }

/** Repair list layout on a parsing copy; never remove @ inside emails or handles. */
function parsingLines(text: string) {
  const lines: string[] = [];
  let listItem = false;
  for (const raw of text.slice(0, 30000).normalize('NFKC').split(/\r?\n/)) {
    let line = raw.trim().replace(/\s+/g, ' ').replace(/^#{1,6}\s+/, '').replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, '$1$2');
    if (!line) continue;
    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(line)) { listItem = false; continue; }
    if (navigation(line) || /^[人小全一]$/.test(line)) { listItem = false; continue; }
    line = line.replace(/\s*(?:后\s*)?有\s*问\s*题.*找\s*我.*$/, '').trim();
    if (!line) continue;
    if (/^REQUIREMENTS\b/i.test(line) && /具体\s*职责/.test(line)) line = '具体职责';
    const normalized = line.replace(/\bAl(?=\s*(?:应\s*用|基\s*础|编\s*程))/g, 'AI');
    if (/^(?:任职要求)?根据业务需要与个人兴趣/.test(compact(normalized)) || normalized === '具体职责') {
      lines.push('岗位职责'); listItem = false; continue;
    }
    // Numbered group captions describe sections, not skills or requirements.
    if (/^\d+[.)、]\s*(?:基础条件|专业能力|能力特质|(?:AI\s*)?基础设施建设|服务与工程模块开发|工程质量与治理|Agent\s*应用开发)[一二三]?$/i.test(joinChinese(normalized))) {
      listItem = false; continue;
    }
    const item = bullet(normalized), startsItem = item !== normalized;
    const boundary = isHeading(item) || new RegExp(`^(?:${labelPattern})(?:\\s|:)`, 'i').test(item)
      || /^(?:\d+[.)、]|[^:]{1,15}:|@[a-z0-9_]|上\s*旦|田\s*~)/i.test(normalized);
    if (listItem && !startsItem && !boundary && lines.length) {
      lines[lines.length - 1] = joinChinese(`${lines[lines.length - 1]} ${item}`);
    } else { lines.push(item); listItem = startsItem; }
    if (boundary && !startsItem) listItem = false;
  }
  return lines;
}

/** Local, evidence-based extraction: explicit values beat layout hints; ambiguity stays blank. */
export function extractJobFields(text: string, onLimit?: (key: Section) => void): Fields {
  const result: Fields = { ...EMPTY_FIELDS, required: [], preferred: [], availability: [], tags: [] };
  const explicit = new Map<Scalar, Set<string>>();
  const inferred = new Map<Scalar, Set<string>>();
  const lines = parsingLines(text);
  const headers: string[] = [];
  let inHeader = true;
  let inDescription = false;
  let section: Section | null = null;
  let pending: Scalar | null = null;
  let pendingLabel = '';
  function add(key: Scalar, raw: string, direct = false, label = '') {
    let value = clean(key === 'company' || key === 'title' ? headerText(raw) : key === 'salary' ? raw : joinChinese(raw));
    if (/^(立即沟通|立即投递|收藏|分享|查看全部职位|返回)$/.test(value)) return;
    if ((key === 'company' || key === 'title') && (/^(实习|校招|社招|本科|硕士|博士|大专|学历不限)$/.test(value) || value.match(salaryPattern)?.join('') === value)) return;
    if (!value || isHeading(value) || value.length > (key === 'company' || key === 'title' ? 200 : 2000)) return;
    // A daily/monthly label is part of the salary's unit evidence.
    if (key === 'salary' && /^(日薪|月薪)$/.test(label)) value = `${label} ${value}`;
    const target = direct ? explicit : inferred;
    if (!target.has(key)) target.set(key, new Set());
    target.get(key)!.add(value);
    if (direct && (key === 'days_per_week' || key === 'internship_duration')) append('availability', `${label}: ${value}`);
  }
  function append(key: Section, raw: string) {
    const value = bullet(raw);
    const identity = (s: string) => s.replace(/[\s,，、;；。]/g, '').toLowerCase();
    if (!value || result[key].some(item => identity(item) === identity(value))) return;
    if (value.length > 2000 || result[key].length >= 40) { onLimit?.(key); return; }
    result[key].push(value);
  }
  function content(raw: string) {
    if (section) {
      raw = joinChinese(raw);
      if (section === 'tags') raw.split(/[,，、|]/).forEach(value => append('tags', value));
      else if (section === 'required' && /优先|加分|\bpreferred\b|\ba plus\b/i.test(raw)) {
        // A bonus clause inside requirements is still optional, not a hard condition.
        for (const clause of raw.split(/[;；]|[,，](?=[^,，;；]*(?:优先|加分|\bpreferred\b|\ba plus\b))/i).map(clean).filter(Boolean))
          append(/优先|加分|\bpreferred\b|\ba plus\b/i.test(clause) ? 'preferred' : 'required', clause);
      } else append(section, raw);
    } else if (inHeader) headers.push(raw);
    else if (inDescription && /熟悉|掌握|熟练|具备|本科|硕士|博士|学历不限|每周|到岗|实习.*月|20\d{2}.*届|优先|加分/.test(raw)) {
      append(/优先|加分/.test(raw) ? 'preferred' : 'required', raw);
    }
  }
  for (const line of lines) {
    if (navigation(line)) continue;
    if (/^(推荐职位|相似职位|其他职位|你可能感兴趣|related jobs|similar jobs)$/.test(heading(line))) break;
    // Colon-separated fields can share a line, including OCR-spaced labels.
    const markers = [...line.matchAll(new RegExp(`(?:^|[\\s|;,])(${labelPattern})\\s*:\\s*`, 'gi'))];
    const bare = heading(line);
    if (markers.length || isHeading(line)) {
      pending = null;
      if (!markers.length) {
        if (bare in LABELS) { pending = LABELS[bare]; pendingLabel = bare; section = null; }
        else { section = SECTIONS[bare] || null; inHeader = false; inDescription = /^(职位描述|岗位描述|job description)$/.test(bare); }
        continue;
      }
      if (markers[0].index! > 0) content(line.slice(0, markers[0].index));
      for (let i = 0; i < markers.length; i++) {
        const marker = markers[i];
        const name = heading(marker[1]);
        // Also stop a value at an unknown labelled column, such as 联系电话:… .
        const value = clean(line.slice(marker.index! + marker[0].length, markers[i + 1]?.index ?? line.length).replace(/\s+[^\s:|;,]{1,12}\s*:.*/, ''));
        if (name in LABELS) {
          section = null;
          if (value) add(LABELS[name], value, true, name);
          else { pending = LABELS[name]; pendingLabel = name; }
        } else {
          inHeader = false;
          section = SECTIONS[name] || null;
          inDescription = /^(职位描述|岗位描述|job description)$/.test(name);
          if (value) content(value);
        }
      }
      continue;
    }
    // Common exports use a label, whitespace, then the value without a colon.
    const spaced = line.match(new RegExp(`^(${labelPattern})\\s+(.+)$`, 'i'));
    if (spaced) {
      pending = null;
      const name = heading(spaced[1]);
      if (name in LABELS) { add(LABELS[name], spaced[2], true, name); section = null; }
      else { section = SECTIONS[name] || null; inHeader = false; inDescription = /^(职位描述|岗位描述|job description)$/.test(name); content(spaced[2]); }
      continue;
    }
    if (pending) {
      // Do not put a whole metadata row or a different label into a pending field.
      if (!/[|]|\s+[^\s:]{1,12}:/.test(line) && !/^[^:]{1,12}:/.test(line)) add(pending, line, true, pendingLabel);
      pending = null;
      continue;
    }
    if (/^[^:]{1,12}:\s*$/.test(line)) { section = null; inHeader = false; inDescription = false; continue; }
    content(line);
  }

  // Only the page header supplies unlabelled company, title, location and salary.
  // Responsibilities, company descriptions and recommended jobs cannot supply them.
  for (const original of headers) {
    const raw = headerText(original);
    if (raw.length > 160 || /^(首页|职位列表|职位详情|招聘详情|返回|立即沟通|立即投递|收藏|分享)$/.test(raw)) continue;
    const company = raw.length <= 80 && /(?:有限责任公司|有限公司|集团|科技|软件|网络|工作室)$/.test(raw) && !/[。:;|]/.test(raw);
    if (company) { add('company', raw); continue; }
    for (const match of raw.matchAll(salaryPattern)) add('salary', match[0]);
    if (raw === '面议') add('salary', raw);
    for (const token of original.split(/[|;,\s]+/)) {
      const city = token.match(cityPattern);
      if (city) add('city', city[0]);
    }
    const joinedCity = compact(original).match(metadataCity);
    if (joinedCity) add('city', joinedCity[0]);
    if (/实习/.test(raw)) add('job_type', '实习');
    if (/校招|校园招聘/.test(raw)) add('job_type', '校招');
    if (/社招|社会招聘/.test(raw)) add('job_type', '社招');
    for (const part of raw.split(/[|;]/)) {
      const title = titleText(part);
      if (title) add('title', title);
    }
  }
  // A short brand name needs structural evidence: unique title + adjacent metadata.
  // Do not guess a company from arbitrary prose, technology lists or recommendations.
  const titles = explicit.get('title') ?? inferred.get('title');
  if (!explicit.has('company') && !inferred.has('company') && titles?.size === 1) {
    const title = [...titles][0];
    headers.forEach((line, index) => {
      if (titleText(line) !== title || !headers.slice(index + 1, index + 3).some(metadata)) return;
      for (const candidate of [headers[index - 1], headers[index + 1]]) {
        if (!candidate) continue;
        const name = headerText(candidate);
        if (name.length < 2 || name.length > 40 || !/^[\p{Script=Han}A-Za-z][\p{Script=Han}A-Za-z0-9 &·.-]+$/u.test(name)
          || metadata(candidate) || isHeading(name) || titleText(name) || navigation(name)
          || /实习|校招|社招|本科|硕士|博士|经验|要求|欢迎|机会|职责|岗位|职位|首页|登录/.test(name)
          || skills.some(([pattern]) => new RegExp(`^(?:${pattern})$`, 'i').test(name))) continue;
        add('company', name);
      }
    });
  }
  const conditions = [...headers, ...result.required, ...result.availability];
  for (const raw of conditions.flatMap(line => joinChinese(line).split(/[,;。]/))) {
    if (/优先|加分|无需|不要求|不需要/.test(raw) || /(?:有限责任公司|有限公司|集团|科技|软件|网络|工作室)$/.test(raw)) continue;
    for (const match of raw.matchAll(educationPattern)) add('education', match[0]);
    for (const match of raw.matchAll(/(?:每周|一周|周)\s*(?:至少|不少于|到岗|出勤|工作)?\s*[1-7一二三四五六七](?:\s*[-~至到]\s*[1-7一二三四五六七])?\s*天|[1-7一二三四五六七](?:\s*[-~至到]\s*[1-7一二三四五六七])?\s*天\s*\/\s*周/g)) add('days_per_week', match[0]);
    for (const match of raw.matchAll(/实习(?:时长|时间|周期|期限)?\s*(?:至少|不少于|不低于|最短|需|需要|满|为)?\s*\d+(?:\s*[-~至到]\s*\d+)?\s*个?月(?:以上|起)?/g)) add('internship_duration', match[0]);
    for (const match of raw.matchAll(/20\d{2}(?:\s*[-~/、]\s*(?:20)?\d{2})?\s*届|20\d{2}\s*年毕业/g)) add('graduation_year', match[0]);
  }
  for (const line of [...result.required]) {
    if (/每周|实习.*月|到岗|入职|\bdays?\s*(?:per|a|\/)\s*week\b|\bstart date\b/i.test(line)) append('availability', line);
  }
  for (const key of Object.keys(EMPTY_FIELDS) as (keyof Fields)[]) {
    if (['required', 'preferred', 'availability', 'tags'].includes(key)) continue;
    const candidates = explicit.get(key as Scalar) ?? inferred.get(key as Scalar);
    if (candidates?.size === 1) Object.assign(result, { [key]: [...candidates][0] });
  }
  if (!explicit.has('job_type') && result.title) {
    if (/实习/.test(result.title)) result.job_type = '实习';
    else if (/校招|校园招聘/.test(result.title)) result.job_type = '校招';
    else if (/社招|社会招聘/.test(result.title)) result.job_type = '社招';
  }
  const skillText = [result.title, ...result.required, ...result.preferred];
  for (const [pattern, name] of skills) {
    if (skillText.some(line => [...line.matchAll(new RegExp(`(?<![a-z0-9_])(?:${pattern})(?![a-z0-9_])`, 'gi'))]
      .some(match => !/(?:无需|不要求|不需要).{0,10}$/.test(line.slice(0, match.index).split(/[,;。]/).at(-1) || '')))) append('tags', name);
  }
  return result;
}
