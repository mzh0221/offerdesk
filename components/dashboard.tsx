'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BriefcaseBusiness, ArrowUpRight, Search, MapPin, ChevronDown, ChevronLeft, ChevronRight, ImagePlus, ArrowRight, CircleHelp, LogOut, LoaderCircle, X, Check, RotateCcw, Clipboard } from 'lucide-react';
import AddJob from './add-job';
import JobDetail from './job-detail';
import RecruitmentLink from './recruitment-link';
import Dialog from './dialog';
import { clientApi } from '@/lib/client';
import { seedDemo } from '@/lib/demo';
import { browserClient } from '@/lib/supabase/browser';
import { STATUSES, splitCities, type Job } from '@/lib/domain';
type Facet = {
    city: string | null;
    job_type: string | null;
    status: string;
};
export default function Dashboard({ demo, email }: {
    demo: boolean;
    email: string;
}) {
    const api = useMemo(() => clientApi(demo), [demo]);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [facets, setFacets] = useState<Facet[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [search, setSearch] = useState('');
    const [city, setCity] = useState('');
    const [status, setStatus] = useState('');
    const [type, setType] = useState('');
    const [page, setPage] = useState(1);
    const [add, setAdd] = useState(false);
    const [detail, setDetail] = useState<string | null>(null);
    const [help, setHelp] = useState(false);
    const [pending, setPending] = useState<string | null>(null);
    const [resume, setResume] = useState<string | undefined>();
    const [refresh, setRefresh] = useState(0);
    const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
    const [entryMode, setEntryMode] = useState<'images' | 'text'>('images');
    const [toast, setToast] = useState('');
    const sequence = useRef(0);
    const [ready, setReady] = useState(!demo);
    useEffect(() => { let active = true; if (demo)
        seedDemo().then(() => { if (active)
            setReady(true); }).catch(e => { setError(e.message); setLoading(false); }); setPending(sessionStorage.getItem('offerdesk-pending-import')); return () => { active = false; }; }, [demo]);
    useEffect(() => { const timer = setTimeout(() => { setSearch(query); setPage(1); }, 250); return () => clearTimeout(timer); }, [query]);
    useEffect(() => { setPage(1); }, [city, status, type]);
    useEffect(() => { if (!ready)
        return; const current = ++sequence.current; setLoading(true); setError(''); const params = new URLSearchParams({ q: search, city, status, job_type: type, page: String(page) }); api.request(`jobs?${params}`).then(data => { if (current !== sequence.current)
        return; setJobs(data.items); setTotal(data.total); setFacets(data.facets); if (page > 1 && data.items.length === 0)
        setPage(page - 1); }).catch(e => { if (current === sequence.current)
        setError(e.message); }).finally(() => { if (current === sequence.current)
        setLoading(false); }); }, [api, ready, search, city, status, type, page, refresh]);
    useEffect(() => { if (!toast)
        return; const timer = setTimeout(() => setToast(''), 3000); return () => clearTimeout(timer); }, [toast]);
    const reload = useCallback(() => setRefresh(v => v + 1), []);
    async function updateStatus(job: Job, next: string) {
        if (next === job.status || updatingStatus) return;
        setUpdatingStatus(job.id);
        try {
            const updated = await api.request(`jobs/${job.id}`, 'PATCH', { status: next });
            setJobs(current => current.map(item => item.id === job.id ? updated : item));
            reload();
            setToast('投递状态已更新');
        } catch (e) {
            setError(e instanceof Error ? e.message : '更新失败');
        } finally { setUpdatingStatus(null); }
    }
    function openAdd(mode: 'images' | 'text' = 'images') { setEntryMode(mode); setResume(undefined); setAdd(true); }
    function statusControl(job: Job) {
        return <div className={`quick-status status-${STATUSES.indexOf(job.status)}`}>
            {updatingStatus === job.id ? <LoaderCircle size={12} className="spin"/> : <i/>}
            <select aria-label={`更新 ${job.title} 的投递状态`} value={job.status} disabled={!!updatingStatus} onChange={e => updateStatus(job, e.target.value)}>
                {STATUSES.map(value => <option key={value}>{value}</option>)}
            </select><ChevronDown size={12}/>
        </div>;
    }
    const count = (s: string) => facets.filter(f => f.status === s).length;
    const cities = [...new Set(facets.flatMap(f => splitCities(f.city)))];
    const types = [...new Set(facets.map(f => f.job_type).filter(Boolean))] as string[];
    function reset() { setQuery(''); setCity(''); setStatus(''); setType(''); setPage(1); }
    function closeAdd() { setAdd(false); setPending(sessionStorage.getItem('offerdesk-pending-import')); setResume(undefined); }
    return <div className="app-shell focused-workbench">
        <main className="main">
            <header className="workbench-header">
                <a href="/" className="brand"><span className="brand-icon"><BriefcaseBusiness size={20}/></span>OfferDesk<span className="brand-dot">.</span></a>
                <span className="header-divider"/><span className="workspace-name">岗位投递台</span>
                <div className="header-tools">
                    <button className="help-button" onClick={() => setHelp(true)}><CircleHelp size={16}/><span>使用说明</span></button>
                    <span className="account-label">{demo ? '本地演示' : email.split('@')[0]}</span>
                    {!demo && <button className="icon-button" aria-label="退出登录" onClick={async () => { await browserClient().auth.signOut(); location.assign('/login'); }}><LogOut size={16}/></button>}
                </div>
            </header>
            <div className="page-content">
                <section className="workbench-title">
                    <div><h1>岗位与投递</h1><p>截图收集岗位，直接跟进投递。</p></div>
                    <div className="entry-actions"><button className="secondary" onClick={() => openAdd('text')}><Clipboard size={15}/>文字录入</button><button className="primary screenshot-action" onClick={() => openAdd()}><ImagePlus size={18}/>上传岗位截图</button></div>
                </section>
                {demo && <div className="demo-inline"><span className="demo-label">演示</span><span>已整理长三角公开实习岗位，详情附招聘原链接。截图自动识别尚未启用。</span><button className="text-button" onClick={() => setHelp(true)}>说明</button></div>}
                <section className="jobs-section" aria-label="岗位列表">
                    <div className="list-navigation"><nav className="status-tabs" aria-label="按投递状态筛选">
                        <button aria-pressed={!status} className={!status ? 'selected' : ''} onClick={() => setStatus('')}>全部岗位<span>{facets.length}</span></button>
                        {STATUSES.map((value, index) => <button key={value} aria-pressed={status === value} className={status === value ? 'selected' : ''} onClick={() => setStatus(value)}><i className={`nav-dot nav-dot-${index}`}/>{value}<span>{count(value)}</span></button>)}
                    </nav></div>
                    <div className="filters">
                        <div className="search-input"><Search size={17}/><input aria-label="搜索公司、岗位或技能" value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索公司、岗位或技能"/>{query && <button className="icon-button" aria-label="清空搜索" onClick={() => setQuery('')}><X size={14}/></button>}</div>
                        <div className="filter-select"><MapPin size={15}/><select aria-label="筛选城市" value={city} onChange={e => setCity(e.target.value)}><option value="">全部城市</option>{cities.map(value => <option key={value}>{value}</option>)}</select><ChevronDown size={13}/></div>
                        <div className="filter-select type-filter"><select aria-label="筛选岗位类型" value={type} onChange={e => setType(e.target.value)}><option value="">全部类型</option>{types.map(value => <option key={value}>{value}</option>)}</select><ChevronDown size={13}/></div>
                        {(query || city || status || type) && <button className="text-button reset-filter" onClick={reset}>清除筛选</button>}
                        {pending && <button className="text-button resume-import" onClick={() => { setResume(pending); setAdd(true); }}><RotateCcw size={14}/>继续上次导入</button>}
                    </div>
                    {error && <div className="notice error" role="alert">{error}<button className="text-button" onClick={reload}>重试</button></div>}
                    <div className={`table-container ${loading ? 'is-loading' : ''}`} aria-busy={loading}>
                        <div className="table-scroll"><table className="jobs-table"><thead><tr><th>岗位 / 公司</th><th>地点</th><th>薪资</th><th>岗位要求</th><th>投递状态 <small>可直接修改</small></th><th>投递日期</th><th>招聘链接</th></tr></thead>
                            <tbody>{jobs.map((job, index) => <tr key={job.id}>
                                <td><button className="job-title-button" onClick={() => setDetail(job.id)}><span className={`company-avatar color-${index % 4}`}>{job.company.replace('示例 · ', '').slice(0, 1) || '岗'}</span><span><strong>{job.title}</strong><small>{job.company}<span className="job-type">{job.job_type || '未分类'}</span></small></span></button></td>
                                <td><span className="city-text">{job.city || '未说明'}</span></td>
                                <td className={job.salary ? 'salary' : 'muted'}>{job.salary || '未说明'}</td>
                                <td><div className="requirements-cell"><div className="tags">{job.tags.slice(0, 3).map((tag, i) => <span key={i}>{tag}</span>)}{job.tags.length > 3 && <span title={job.tags.slice(3).join('、')}>+{job.tags.length - 3}</span>}{!job.tags.length && <small className="muted">技能未说明</small>}</div><p>{[job.education, job.graduation_year, job.days_per_week].filter(Boolean).join(' · ') || '其他要求未说明'}</p></div></td>
                                <td>{statusControl(job)}</td><td className="date-text">{job.applied_at || '—'}</td>
                                <td className="job-actions-cell"><div className="job-row-actions"><RecruitmentLink compact url={job.source_url} jobTitle={job.title}/><button className="text-button row-detail-button" aria-label={`查看 ${job.title} 详情`} onClick={() => setDetail(job.id)}>查看详情<ArrowUpRight size={14}/></button></div></td>
                            </tr>)}</tbody>
                        </table></div>
                        <div className="mobile-jobs">{jobs.map(job => <article className="job-card" key={job.id}><button className="mobile-job-heading" onClick={() => setDetail(job.id)}><span><strong>{job.title}</strong><small>{job.company} · {job.city || '地点未说明'}</small></span><ArrowUpRight size={17}/></button><div className="mobile-job-summary"><span className="salary">{job.salary || '薪资未说明'}</span><span>{job.days_per_week}</span></div><div className="tags">{job.tags.slice(0, 3).map((tag, i) => <span key={i}>{tag}</span>)}</div><div className="mobile-job-source"><RecruitmentLink compact url={job.source_url} jobTitle={job.title}/></div><div className="mobile-job-progress">{statusControl(job)}<span>{job.applied_at ? `投递于 ${job.applied_at}` : '尚未投递'}</span></div></article>)}</div>
                        {loading && <div className="table-loading"><LoaderCircle className="spin" size={18}/>正在读取岗位…</div>}
                        {!loading && !jobs.length && <div className="empty"><span className="empty-icon"><ImagePlus size={30}/></span><h3>{query || city || status || type ? '没有符合条件的岗位' : '上传截图，收集第一个岗位'}</h3><p>{query || city || status || type ? '调整筛选条件，查看其他岗位。' : '核对招聘信息后保存，即可开始管理投递。'}</p><button className="secondary" onClick={query || city || status || type ? reset : () => openAdd()}>{query || city || status || type ? '清除筛选' : '上传岗位截图'}<ArrowRight size={14}/></button></div>}
                    </div>
                    <footer className="table-footer"><span>共 {total} 个岗位{jobs.length ? ` · 本页 ${jobs.length} 个` : ''}</span><div><button className="icon-button" aria-label="上一页" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}><ChevronLeft size={16}/></button><span className="page-number">{page}</span><button className="icon-button" aria-label="下一页" disabled={page * 20 >= total || loading} onClick={() => setPage(page + 1)}><ChevronRight size={16}/></button></div></footer>
                </section>
            </div>
        </main>
    {toast && <div className="toast" role="status"><Check size={16}/>{toast}</div>}{add && <AddJob initialInput={entryMode} demo={demo} resume={resume} onClose={closeAdd} onSaved={() => { closeAdd(); setPending(null); reload(); setToast('新岗位已收进工作台'); }}/>}{detail && <JobDetail id={detail} demo={demo} onClose={() => setDetail(null)} onChanged={reload}/>}{help && <Dialog title="使用你的岗位投递台" onClose={() => setHelp(false)}><div className="dialog-content guide"><span className="mini-icon"><BriefcaseBusiness size={24}/></span><h3>三步，把岗位整理清楚。</h3><ol><li><strong>收集</strong><p>上传同一岗位的1—5张截图，或粘贴招聘文字。截图可以拖拽、粘贴、排序。</p></li><li><strong>核对</strong><p>识别后检查公司、岗位及要求，修正模糊信息，再保存。没有写明的条件会留空。</p></li><li><strong>跟进</strong><p>打开岗位详情，修改状态、日期和备注；招聘原文和截图随时可以回看。</p></li></ol>{demo && <div className="notice">当前为本地模式，初始岗位来自企业公开招聘信息，详情可查看来源和核查日期；是否仍接收申请以招聘方为准。岗位与截图保存在当前浏览器，不会同步到其他设备；截图自动识别尚未启用。</div>}<button className="primary full" onClick={() => setHelp(false)}>开始整理<ArrowRight size={15}/></button></div></Dialog>}
  </div>;
}
