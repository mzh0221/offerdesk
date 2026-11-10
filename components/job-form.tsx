import type { Fields } from '@/lib/domain';
const textFields: [
    keyof Fields,
    string,
    string
][] = [['company', '公司名称', '例如：某某科技'], ['title', '岗位名称', '例如：Java 后端实习生'], ['city', '工作地点', '例如：杭州'], ['salary', '薪资原文', '例如：200–250 元/天'], ['education', '学历要求', '未说明'], ['graduation_year', '毕业年份', '未说明'], ['internship_duration', '实习时长', '例如：至少 3 个月'], ['days_per_week', '每周到岗', '例如：每周 4 天']];
export function cleanFields(fields: Fields): Fields { const result = { ...fields }; for (const key of ['required', 'preferred', 'availability', 'tags'] as const)
    result[key] = result[key].map(s => s.trim()).filter(Boolean); return result; }
export default function JobForm({ value, onChange, children }: {
    value: Fields;
    onChange: (v: Fields) => void;
    children?: React.ReactNode;
}) {
    const input = ([key, label, placeholder]: typeof textFields[number]) => (
        <label key={key}>{label}{(key === 'company' || key === 'title') && <span className="required"> *</span>}
            <input required={key === 'company' || key === 'title'} maxLength={key === 'company' || key === 'title' ? 200 : 2000}
                value={(value[key] as string) || ''} placeholder={placeholder}
                onChange={e => onChange({ ...value, [key]: e.target.value || null })}/>
        </label>
    );
    return <div className="job-form">
        <h3 className="form-group-title">基本信息</h3>
        <div className="form-grid">{textFields.slice(0, 4).map(input)}</div>
        {children}
        <details className="optional-fields" open>
            <summary>岗位条件（选填）</summary>
            <div className="form-grid">
                {textFields.slice(4).map(input)}
                <label>岗位类型<select value={value.job_type || ''} onChange={e => onChange({ ...value, job_type: e.target.value || null })}>
                    <option value="">未填写</option>{['实习', '校招', '社招'].map(t => <option key={t}>{t}</option>)}
                    {value.job_type && !['实习', '校招', '社招'].includes(value.job_type) && <option>{value.job_type}</option>}
                </select></label>
                <label>技能标签<input maxLength={600} value={value.tags.join(',')} placeholder="Java, Spring Boot, SQL"
                    onChange={e => onChange({ ...value, tags: e.target.value.split(/[,，]/) })}/></label>
            </div>
        </details>
        <details className="optional-fields" open>
            <summary>详细要求（选填）</summary>
            <div className="requirements-fields">
                {([['required', '必备技能'], ['preferred', '加分项'], ['availability', '到岗条件']] as const).map(([key, label]) =>
                    <label key={key}>{label}<textarea aria-label={label} rows={3} maxLength={15000} value={value[key].join('\n')}
                        placeholder="一行一项；没有写明可以留空" onChange={e => onChange({ ...value, [key]: e.target.value.split('\n') })}/></label>)}
            </div>
        </details>
    </div>;
}
