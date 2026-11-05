'use client';
import { useEffect, useMemo, useState } from 'react';
import { ImagePlus, Clipboard, Sparkles, LoaderCircle, X, ArrowUp, ArrowDown, ArrowLeft, Check, FileText } from 'lucide-react';
import Dialog from './dialog';
import JobForm, { cleanFields } from './job-form';
import AttachmentImage from './attachment-image';
import { clientApi } from '@/lib/client';
import { EMPTY_FIELDS, validateImage, safeSourceUrl, type Fields, type Attachment } from '@/lib/domain';
function Preview({ file }: {
    file: File;
}) { const url = useMemo(() => URL.createObjectURL(file), [file]); useEffect(() => () => URL.revokeObjectURL(url), [url]); return <img src={url} alt={file.name}/>; }
export default function AddJob({ demo, onClose, onSaved, resume, initialInput = 'images' }: {
    demo: boolean;
    onClose: () => void;
    onSaved: () => void;
    resume?: string;
    initialInput?: 'images' | 'text';
}) {
    const api = useMemo(() => clientApi(demo), [demo]);
    const [tab, setTab] = useState<'images' | 'text'>(initialInput);
    const [files, setFiles] = useState<File[]>([]);
    const [text, setText] = useState('');
    const [step, setStep] = useState<'input' | 'review'>('input');
    const [fields, setFields] = useState<Fields>({ ...EMPTY_FIELDS });
    const [warnings, setWarnings] = useState<string[]>([]);
    const [source, setSource] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [importId, setImportId] = useState<string | null>(resume || null);
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    useEffect(() => { if (!resume)
        return; let active = true; setBusy(true); api.request(`imports/${resume}`).then(item => { if (!active)
        return; setTab(item.input_type); setAttachments(item.attachments || []); setText(item.raw_text || ''); if (item.extracted) {
        setFields(item.extracted);
        setWarnings(item.extracted.warnings || []);
        setStep('review');
    } if (item.state === 'saved')
        setError('该导入已保存，重复保存将返回原岗位。'); if (item.state === 'processing')
        setError('上次识别可能仍在运行。稍候重试，或手动填写。'); }).catch(e => setError(e.message)).finally(() => setBusy(false)); return () => { active = false; }; }, [resume, api]);
    function addFiles(incoming: File[]) { if (busy)
        return; setError(''); const combined = [...files, ...incoming]; if (combined.length > 5) {
        setError('一个岗位最多上传5张截图');
        return;
    } for (const file of incoming) {
        const issue = validateImage(file.type, file.size);
        if (issue) {
            setError(issue);
            return;
        }
    } setFiles(combined); setImportId(null); setAttachments([]); }
    function swap(index: number, offset: number) { const next = [...files]; [next[index], next[index + offset]] = [next[index + offset], next[index]]; setFiles(next); setImportId(null); }
    async function ensureImport() { if (importId)
        return importId; if (tab === 'images' && !files.length)
        return null; if (tab === 'text' && !text.trim())
        return null; const item = await api.request('imports', 'POST', { input_type: tab, raw_text: tab === 'text' ? text : '' }); if (files.length && tab === 'images')
        await api.upload(item.id, files); setImportId(item.id); sessionStorage.setItem('offerdesk-pending-import', item.id); return item.id as string; }
    async function extract() { setBusy(true); setError(''); try {
        const id = await ensureImport();
        if (!id)
            throw new Error(tab === 'images' ? '请先添加截图' : '请先粘贴招聘原文');
        const item = await api.request(`imports/${id}/extract`, 'POST');
        setFields(item.extracted);
        setWarnings(item.extracted.warnings || []);
        setText(item.extracted.raw_text || '');
        setStep('review');
    }
    catch (e) {
        setError(e instanceof Error ? e.message : '识别失败');
    }
    finally {
        setBusy(false);
    } }
    async function manual() { setBusy(true); setError(''); try {
        await ensureImport();
        setStep('review');
    }
    catch (e) {
        setError(e instanceof Error ? e.message : '上传失败');
    }
    finally {
        setBusy(false);
    } }
    async function save(e: React.FormEvent) { e.preventDefault(); setBusy(true); setError(''); try {
        if (!fields.company?.trim() || !fields.title?.trim())
            throw new Error('请填写公司和岗位名称');
        if (source && !safeSourceUrl(source))
            throw new Error('招聘链接需要以 http:// 或 https:// 开头');
        const duplicates = await api.request(`jobs?q=${encodeURIComponent(fields.company)}`);
        if (duplicates.items.some((j: Fields) => j.company === fields.company.trim() && j.title === fields.title.trim()) && !window.confirm('已存在同公司、同名称的岗位，仍要保存吗？'))
            return;
        await api.request('jobs', 'POST', { ...cleanFields(fields), company: fields.company.trim(), title: fields.title.trim(), import_id: importId, source_url: safeSourceUrl(source), status: '待投递', applied_at: null, notes: '' });
        sessionStorage.removeItem('offerdesk-pending-import');
        onSaved();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : '保存失败');
    }
    finally {
        setBusy(false);
    } }
    return <Dialog title={step === 'input' ? '收集一个新机会' : '核对岗位信息'} wide onClose={() => { if (!busy)
        onClose(); }}><div className="dialog-content" onPaste={e => { if (tab !== 'images' || step !== 'input' || attachments.length)
        return; const incoming = Array.from(e.clipboardData.files); if (incoming.length) {
        e.preventDefault();
        addFiles(incoming);
    } }}>
    <div className="stepper"><span className="active"><i>{step === 'review' ? <Check size={12}/> : 1}</i>添加招聘信息</span><b /><span className={step === 'review' ? 'active' : ''}><i>2</i>核对并保存</span></div>
    {error && <div className="notice error" role="alert">{error}</div>}
    {step === 'input' ? <><div className="segmented"><button className={tab === 'images' ? 'selected' : ''} disabled={busy || !!resume} onClick={() => { setTab('images'); setImportId(null); }}><ImagePlus size={16}/>上传截图</button><button className={tab === 'text' ? 'selected' : ''} disabled={busy || !!resume} onClick={() => { setTab('text'); setImportId(null); }}><Clipboard size={16}/>粘贴文字</button></div>
      {tab === 'images' ? <><label className={`upload-zone ${busy ? 'disabled' : ''}`} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!attachments.length)
            addFiles(Array.from(e.dataTransfer.files)); }}><input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy || !!attachments.length} onChange={e => { addFiles(Array.from(e.target.files || [])); e.target.value = ''; }}/><span className="upload-icon"><ImagePlus size={30}/></span><strong>把岗位截图放在这里</strong><span>点击选择、拖拽图片，或直接 Ctrl / ⌘ + V 粘贴</span><small>同一岗位最多 5 张 · JPG / PNG / WebP · 每张 ≤ 5MB</small></label><div className="image-grid">{files.map((f, i) => <div className="upload-preview" key={`${f.name}-${i}`}><Preview file={f}/><div><span>{i + 1}. {f.name}</span><button disabled={busy || i === 0} className="icon-button" aria-label="前移截图" onClick={() => swap(i, -1)}><ArrowUp size={13}/></button><button disabled={busy || i === files.length - 1} className="icon-button" aria-label="后移截图" onClick={() => swap(i, 1)}><ArrowDown size={13}/></button><button disabled={busy} className="icon-button" aria-label="移除截图" onClick={() => { setFiles(files.filter((_, idx) => idx !== i)); setImportId(null); }}><X size={14}/></button></div></div>)}{attachments.map(a => <AttachmentImage key={a.id} item={a} demo={demo}/>)}</div><div className="hint"><Sparkles size={16}/><p>把同一岗位的介绍和要求一起上传，重叠内容会合并整理。<br /><span>一次只录入一个岗位，识别后可以手动核对。</span></p></div></> : <label className="text-import">招聘原文<textarea rows={12} maxLength={30000} value={text} disabled={busy || !!resume} onChange={e => { setText(e.target.value); setImportId(null); }} placeholder="把公司、岗位介绍、任职要求粘贴到这里…"/></label>}
      <div className="dialog-actions"><button className="secondary" disabled={busy} onClick={manual}>手动填写</button><button className="primary" disabled={busy || (tab === 'images' ? !files.length && !attachments.length : !text.trim())} onClick={extract}>{busy ? <LoaderCircle size={16} className="spin"/> : <Sparkles size={16}/>} {busy ? '正在处理…' : '提取岗位信息'}</button></div></> : <form onSubmit={save}>{warnings.length > 0 && <div className="notice"><strong>请核对以下内容</strong><ul>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></div>}<p className="form-help">缺失信息可以留空，保存后仍可修改。</p><JobForm value={fields} onChange={setFields}/><label className="block-label">招聘链接（选填）<input type="url" maxLength={2000} value={source} onChange={e => setSource(e.target.value)} placeholder="https://…"/></label>{(text || files.length > 0 || attachments.length > 0) && <details className="source-details"><summary><FileText size={15}/>核对原始招聘信息</summary>{text && <pre>{text}</pre>}<div className="image-grid">{files.map((f, i) => <figure className="source-image" key={i}><Preview file={f}/></figure>)}{attachments.map(a => <AttachmentImage key={a.id} item={a} demo={demo}/>)}</div></details>}<div className="dialog-actions"><button type="button" className="secondary" disabled={busy} onClick={() => setStep('input')}><ArrowLeft size={15}/>返回</button><button className="primary" disabled={busy}>{busy ? <LoaderCircle size={16} className="spin"/> : <Check size={16}/>}保存到岗位列表</button></div></form>}
    {demo && <p className="demo-foot">本地保存 · 不跨设备同步 · 自动识别尚未启用</p>}
  </div></Dialog>;
}
