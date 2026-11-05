import { EMPTY_FIELDS, type Fields } from './domain.ts';

// Require explicit labels: recruitment headings without labels remain for manual review.
export function extractJobFields(text: string): Fields {
  const result: Fields = { ...EMPTY_FIELDS, required: [], preferred: [], availability: [], tags: [] };
  const lines = text.normalize('NFKC').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const labels: Record<string, keyof Fields> = {
    公司: 'company', 公司名称: 'company', 企业名称: 'company',
    岗位: 'title', 岗位名称: 'title', 职位: 'title', 职位名称: 'title',
    城市: 'city', 工作城市: 'city', 工作地点: 'city',
    薪资: 'salary', 薪酬: 'salary', 薪资待遇: 'salary',
    学历: 'education', 学历要求: 'education',
    毕业年份: 'graduation_year', 毕业时间: 'graduation_year',
    实习时长: 'internship_duration', 实习时间: 'internship_duration',
    每周天数: 'days_per_week', 每周出勤: 'days_per_week',
    岗位类型: 'job_type', 职位类型: 'job_type',
  };
  const values = new Map<keyof Fields, Set<string>>();
  let section: 'required' | 'preferred' | null = null;
  for (const line of lines) {
    const heading = line.replace(/[:：]$/, '');
    const sectionHeading = line.match(/^(任职要求|岗位要求|任职资格|加分项|优先条件)(?:[:：]\s*(.*))?$/);
    if (sectionHeading) {
      section = /加分|优先/.test(sectionHeading[1]) ? 'preferred' : 'required';
      const inline = sectionHeading[2]?.trim();
      if (inline && inline.length <= 2000 && !result[section].includes(inline) && result[section].length < 40) result[section].push(inline);
      continue;
    }
    const pair = line.match(/^([^:：]{1,12})[:：]\s*(.+)$/);
    if (pair && labels[pair[1].replace(/\s/g, '')]) {
      section = null;
      const key = labels[pair[1].replace(/\s/g, '')];
      const value = pair[2].trim();
      const limit = key === 'company' || key === 'title' ? 200 : 2000;
      if (value.length <= limit) {
        if (!values.has(key)) values.set(key, new Set());
        values.get(key)!.add(value);
      }
    } else if (pair || /[:：]$/.test(line) || /^(岗位职责|工作职责|职位描述|公司介绍|福利待遇|联系方式)$/.test(heading)) {
      section = null;
    } else if (section && result[section].length < 40 && line.length <= 2000) {
      const value = line.replace(/^(?:[-•·]|\d+[.)、])\s*/, '');
      if (!result[section].includes(value)) result[section].push(value);
    }
  }
  for (const [key, candidates] of values) {
    if (candidates.size === 1) Object.assign(result, { [key]: [...candidates][0] });
  }
  return result;
}
