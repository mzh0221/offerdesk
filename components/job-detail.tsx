import { useEffect, useState } from 'react';
import { MapPin, Pencil, Trash2, Check, LoaderCircle, FileImage, Building2, CalendarDays, GraduationCap, Clock3 } from 'lucide-react';
import Dialog from './dialog';
import { useUnsavedChanges } from './use-unsaved-changes';
import JobForm, { cleanFields } from './job-form';
import AttachmentImage from './attachment-image';
import RecruitmentLink from './recruitment-link';
import { localClient as api } from '@/lib/local-client';
import { STATUSES, safeSourceUrl, type Job, type Attachment } from '@/lib/domain';
export function StatusBadge({ status }: {
    status: string;
}) { return <span className={`status-badge status-${STATUSES.indexOf(status as Job['status'])}`}><i />{status}</span>; }
export default function JobDetail({ id, onClose, onChanged }: {
    id: string;
    onClose: () => void;
    onChanged: () => void;
}) {
    const [job, setJob] = useState<Job | null>(null);
    const [files, setFiles] = useState<Attachment[]>([]);
    const [raw, setRaw] = useState('');
    const [editing, setEditing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [baseline, setBaseline] = useState('');
    const [confirmClose, setConfirmClose] = useState(false);
    const dirty = !!job && JSON.stringify(job) !== baseline;
    useUnsavedChanges(dirty || busy);
    function closeDetail() { if (!busy) { if (dirty) setConfirmClose(true); else onClose(); } }
    function cancelChanges() { if (baseline) setJob(JSON.parse(baseline)); setEditing(false); setSaved(false); }

    useEffect(() => { let active = true; api.request(`jobs/${id}`).then(data => { if (active) {
        setJob(data); setBaseline(JSON.stringify(data));
        setFiles(data.attachments || []);
        setRaw(data.raw_text || '');
    } }).catch(e => setError(e.message)); return () => { active = false; }; }, [id, api]);
    async function save(e?: React.FormEvent, closeAfter = false) { e?.preventDefault(); if (!job)
        return; setBusy(true); setError(''); setSaved(false); try {
        if (!job.company?.trim() || !job.title?.trim())
            throw new Error('公司和岗位名称不能为空');
        if (job.source_url && !safeSourceUrl(job.source_url))
            throw new Error('请输入有效的招聘链接');
        const updated = await api.request(`jobs/${id}`, 'PATCH', { ...job, ...cleanFields(job) });
        setJob(updated); setBaseline(JSON.stringify(updated));
        setEditing(false);
        setSaved(true);
        onChanged();
        if (closeAfter) onClose();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : '保存失败');
    }
    finally {
        setBusy(false);
    } }
    async function remove() { setBusy(true); try {
        await api.request(`jobs/${id}`, 'DELETE');
        onChanged();
        onClose();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : '删除失败');
    }
    finally {
        setBusy(false);
    } }
    const footer = job ? <div className="detail-footer expanded-detail-footer">
        {confirmDelete ? <div className="delete-confirm"><p>删除此岗位及关联截图？</p><button type="button" className="danger" disabled={busy} onClick={remove}>确认删除</button><button type="button" className="text-button" disabled={busy} onClick={() => setConfirmDelete(false)}>取消</button></div> : <button type="button" className="text-button danger-text" disabled={busy} onClick={() => setConfirmDelete(true)}><Trash2 size={15}/>删除岗位</button>}
        <div className="detail-save-actions">{dirty && <span className="unsaved-label" role="status">有未保存修改</span>}{dirty && <button type="button" className="text-button" disabled={busy} onClick={cancelChanges}>取消修改</button>}{saved && !dirty && <span className="success" role="status"><Check size={15}/>修改已保存</span>}<button type="submit" form="job-detail-form" className="primary" disabled={busy || !dirty}>{busy ? <LoaderCircle size={16} className="spin"/> : <Check size={16}/>}保存修改</button></div>
    </div> : undefined;
    return <Dialog title="岗位详情" expanded footer={footer} onClose={closeDetail}>
        <div className="dialog-content">
            {confirmClose && <div className="leave-prompt" role="alertdialog" aria-label="未保存修改"><strong>有未保存修改，是否保存后关闭？</strong><div><button type="button" className="primary" disabled={busy} autoFocus onClick={() => { const form = document.getElementById('job-detail-form') as HTMLFormElement; if (form.reportValidity()) void save(undefined, true); }}>保存并关闭</button><button type="button" className="secondary" disabled={busy} onClick={onClose}>放弃修改</button><button type="button" className="text-button" disabled={busy} onClick={() => setConfirmClose(false)}>继续编辑</button></div></div>}
            {error && <div className="notice error" role="alert">{error}</div>}
            {!job ? <div className="loading"><LoaderCircle className="spin"/>正在读取岗位…</div> : <form id="job-detail-form" onSubmit={e => void save(e)}><fieldset disabled={busy}>
                <div className="detail-heading"><div className="company-avatar large">{job.company?.replace('示例 · ', '').slice(0, 1) || '岗'}</div><div><p>{job.company}</p><h2>{job.title}</h2></div></div>
                <div className="detail-meta"><span><MapPin size={16}/>{job.city || '地点未说明'}</span><strong>{job.salary || '薪资未说明'}</strong><StatusBadge status={job.status}/></div>
                <RecruitmentLink url={job.source_url} jobTitle={job.title}/>
                {job.is_reference && <div className="reference-note">公开招聘信息 · 核查于 {job.source_checked_at} · 投递前请通过原链接确认要求与招聘状态。</div>}
                {job.is_sample && <p className="notice">这是一条虚构的演示岗位，用于展示工作台。</p>}
                <div className="detail-columns">
                    <div className="detail-main-column">
                        <section className="detail-section"><div className="section-title"><h3>岗位要求</h3><button type="button" className="text-button" onClick={() => setEditing(!editing)} title="收起表单不会撤销修改，可使用底部取消修改"><Pencil size={15}/>{editing ? '收起编辑' : '编辑信息'}</button></div>
                            {editing ? <><JobForm value={job} onChange={v => setJob({ ...job, ...v })}><label className="block-label">招聘链接<input type="url" value={job.source_url || ''} onChange={e => setJob({ ...job, source_url: e.target.value })}/></label></JobForm></> : <>
                                <div className="detail-facts"><span><GraduationCap size={18}/>{job.education || '学历未说明'}</span><span><CalendarDays size={18}/>{job.graduation_year || '毕业年份未说明'}</span><span><Clock3 size={18}/>{job.internship_duration || '时长未说明'}</span><span><Building2 size={18}/>{job.days_per_week || '到岗天数未说明'}</span></div>
                                <div className="tags">{job.tags.map((tag, i) => <span key={i}>{tag}</span>)}</div>
                                {([['required', '必备技能'], ['preferred', '加分项'], ['availability', '到岗条件']] as const).map(([key, title]) => <div className="requirement-list" key={key}><h4>{title}</h4>{job[key].length ? <ul>{job[key].map((item, i) => <li key={i}>{item}</li>)}</ul> : <p className="muted">未填写，请核对原文</p>}</div>)}
                            </>}
                        </section>
                        {(!!files.length || raw) && <details className="source-details"><summary><FileImage size={16}/>原始招聘信息{files.length > 0 ? ` · ${files.length} 张截图` : ''}</summary>{raw && <pre>{raw}</pre>}<div className="image-grid">{files.map(file => <AttachmentImage key={file.id} item={file}/>)}</div></details>}
                    </div>
                    <aside className="detail-sidebar" aria-label="投递记录">
                        <section className="detail-section"><h3>投递记录</h3><p className="form-help">修改后请点击底部“保存修改”。</p><div className="form-grid"><label>当前状态<select value={job.status} onChange={e => { setSaved(false); setJob({ ...job, status: e.target.value as Job['status'] }); }}>{STATUSES.map(status => <option key={status}>{status}</option>)}</select></label><label>投递日期<input type="date" value={job.applied_at || ''} onChange={e => { setSaved(false); setJob({ ...job, applied_at: e.target.value || null }); }}/></label></div>
                            <label className="block-label">个人备注<textarea rows={8} maxLength={10000} value={job.notes} onChange={e => { setSaved(false); setJob({ ...job, notes: e.target.value }); }} placeholder="记录面试安排、沟通结果，或下次要准备的内容…"/></label>
                        </section>
                    </aside>
                </div>
            </fieldset></form>}
        </div>
    </Dialog>;
}
