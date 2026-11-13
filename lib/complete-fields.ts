import { type Fields } from './domain.ts';
import { extractJobFields } from './ocr-fields.ts';

const listKeys = ['required', 'preferred', 'availability', 'tags'] as const;
const scalarKeys = ['company', 'title', 'city', 'salary', 'education', 'graduation_year', 'internship_duration', 'days_per_week', 'job_type'] as const;
const labels: Record<keyof Fields, string> = {
    company: '公司', title: '岗位', city: '地点', salary: '薪资', education: '学历', graduation_year: '毕业年份',
    internship_duration: '实习时长', days_per_week: '每周到岗', job_type: '岗位类型',
    required: '必备技能', preferred: '加分项', availability: '到岗条件', tags: '技能标签',
};
const identity = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[\s，,、；;。:：!?！？【】\[\]()（）"'“”‘’`]/gu, '');

/** Fill only supported facts from this job's original text; never overwrite scalar edits. */
export function completeJobFields(current: Fields, rawText: string) {
    const limited = new Set<keyof Fields>();
    const extracted = extractJobFields(rawText, key => limited.add(key));
    const fields: Fields = { ...current };
    const filledFields: (keyof Fields)[] = [];
    const warnings: string[] = [];
    for (const key of scalarKeys) {
        if (!current[key]?.trim() && extracted[key]) {
            fields[key] = extracted[key];
            filledFields.push(key);
        }
    }
    for (const key of listKeys) {
        const values = current[key].filter(item => item.trim());
        const limit = key === 'tags' ? 15 : 40;
        let added = false;
        for (const value of extracted[key]) {
            const normalized = identity(value);
            // Keep the supplied wording when it already contains this source fact.
            if (values.some(item => key === 'tags' ? identity(item) === normalized : identity(item).includes(normalized))) continue;
            if (values.length >= limit) {
                limited.add(key);
                break;
            }
            values.push(value);
            added = true;
        }
        fields[key] = values;
        if (added) filledFields.push(key);
        if (limited.has(key)) warnings.push(`${labels[key]}部分内容超过${limit}项或单项长度限制，请核对完整原文`);
    }
    const missing = (['required', 'preferred', 'availability'] as const).filter(key => !fields[key].length).map(key => labels[key]);
    if (missing.length) warnings.push(`仍未提取到${missing.join('、')}；请核对是否已读取完整招聘详情，原文未说明时保持为空`);
    return { fields, filledFields, warnings };
}

export function completionMessage(filledFields: (keyof Fields)[]) {
    return filledFields.length ? `已从原文补充${filledFields.map(key => labels[key]).join('、')}，请核对后保存。` : '没有找到可补充的明确内容，请核对原文；未说明的信息保持为空。';
}
