import { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, LoaderCircle, X, ArrowUp, ArrowDown, ArrowLeft, Check, FileText } from 'lucide-react';
import Dialog from './dialog';
import OcrCrop from './ocr-crop';
import type { OcrRegion } from '@/lib/ocr-image';
import { useUnsavedChanges } from './use-unsaved-changes';
import { recognizeScreenshot } from '@/lib/ocr';
import { extractJobFields } from '@/lib/ocr-fields';
import JobForm, { cleanFields } from './job-form';
import AttachmentImage from './attachment-image';
import { localClient as api } from '@/lib/local-client';
import { EMPTY_FIELDS, validateImage, safeSourceUrl, type Fields, type Attachment } from '@/lib/domain';
function Preview({ file }: {
    file: File;
}) { const url = useMemo(() => URL.createObjectURL(file), [file]); useEffect(() => () => URL.revokeObjectURL(url), [url]); return <img src={url} alt={file.name}/>; }
export default function AddJob({ onClose, onSaved, resume, initialInput = 'images' }: {
    onClose: () => void;
    onSaved: () => void;
    resume?: string;
    initialInput?: 'images' | 'manual';
}) {
    const [inputType, setInputType] = useState<'images' | 'text'>(initialInput === 'manual' ? 'text' : 'images');
    const [files, setFiles] = useState<File[]>([]);
    const [text, setText] = useState('');
    const [step, setStep] = useState<'input' | 'review'>(initialInput === 'manual' ? 'review' : 'input');
    const [fields, setFields] = useState<Fields>({ ...EMPTY_FIELDS });
    const [ocrResults, setOcrResults] = useState<Record<string, string>>({});
    const [textEdited, setTextEdited] = useState(false);
    const [additionalText, setAdditionalText] = useState('');
    const [progress, setProgress] = useState('');
    const [recognized, setRecognized] = useState(false);
    const [ocrErrors, setOcrErrors] = useState<string[]>([]);
    const [imageErrors, setImageErrors] = useState<Record<string, string>>({});
    const [activeImage, setActiveImage] = useState<string | null>(null);
    const [regions, setRegions] = useState<(OcrRegion | null)[]>([]);
    const [cropTarget, setCropTarget] = useState<{file: Blob; index: number} | null>(null);
    const controller = useRef<AbortController | null>(null);
    useEffect(() => () => controller.current?.abort(), []);
    const [source, setSource] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [importId, setImportId] = useState<string | null>(resume || null);
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [loadingDraft, setLoadingDraft] = useState(!!resume);
    const [savedSnapshot, setSavedSnapshot] = useState('');
    const [savingDraft, setSavingDraft] = useState(false);
    const [confirmClose, setConfirmClose] = useState(false);
    const idRef = useRef<string | null>(resume || null);
    const queue = useRef<Promise<unknown>>(Promise.resolve());
    const savedFiles = useRef<File[] | undefined>(undefined);
    const finished = useRef(false);
    const changingFiles = useRef(false);
    function body(nextFields = fields, overrides: Record<string, unknown> = {}) {
        return { input_type: inputType, raw_text: text, extracted: { ...cleanFields(nextFields), company: nextFields.company || '', title: nextFields.title || '' }, source_url: source, step, additional_text: additionalText, ocr_regions: regions, ...overrides };
    }
    function snapshot(data = body(), images = files, existing = attachments) {
        return JSON.stringify({ data, images: images.map(f => [f.name, f.size, f.lastModified]), existing: existing.map(a => a.id) });
    }
    const currentSnapshot = snapshot();
    const hasContent = !!(importId || files.length || attachments.length || text || source || Object.values(fields).some(v => Array.isArray(v) ? v.some(Boolean) : v));
    const dirty = !loadingDraft && hasContent && currentSnapshot !== savedSnapshot;
    useUnsavedChanges(dirty || busy);
    async function writeDraft(data: ReturnType<typeof body>, images = files, existing = attachments, forceFiles = false) {
        const signature = snapshot(data, images, existing);
        const task = queue.current.catch(() => {}).then(async () => {
            if (finished.current) return idRef.current;
            setSavingDraft(true);
            try {
                const item = await api.draft(idRef.current, data, forceFiles || savedFiles.current !== images ? (data.input_type === 'text' ? [] : images) : undefined);
                idRef.current = item.id; savedFiles.current = images;
                setImportId(item.id); setSavedSnapshot(signature);
                return item.id as string;
            } finally { setSavingDraft(false); }
        });
        queue.current = task;
        return task;
    }
    useEffect(() => {
        if (!dirty || busy || loadingDraft) return;
        const timer = setTimeout(() => { void writeDraft(body()).catch(e => setError(e instanceof Error ? e.message : '草稿保存失败')); }, 500);
        return () => clearTimeout(timer);
    }, [currentSnapshot, dirty, busy, loadingDraft]);
    async function closeWithDraft() {
        if (busy || savingDraft) return;
        if (dirty) { setConfirmClose(true); return; }
        onClose();
    }
    async function keepDraft() {
        setBusy(true); setError('');
        try { await persistDraft(fields); finished.current = true; onClose(); }
        catch (e) { setError(e instanceof Error ? e.message : '草稿保存失败'); }
        finally { setBusy(false); }
    }
    async function discardDraft() {
        setBusy(true); setError('');
        try { await queue.current.catch(() => {}); if (idRef.current) await api.request(`imports/${idRef.current}`, 'DELETE'); finished.current = true; onClose(); }
        catch (e) { setError(e instanceof Error ? e.message : '丢弃失败'); }
        finally { setBusy(false); }
    }
    async function attachmentFiles() {
        return Promise.all(attachments.map(a => api.file(a.id)));
    }
    async function editAttachment(index: number, offset?: number) {
        await replaceFiles(async () => {
            const next = await attachmentFiles();
            if (offset === undefined) next.splice(index, 1);
            else [next[index], next[index + offset]] = [next[index + offset], next[index]];
            return next;
        });
    }
    useEffect(() => {
        if (!resume) return;
        let active = true; setBusy(true);
        api.request(`imports/${resume}`).then(item => {
            if (!active) return;
            const nextFields = item.extracted || (item.input_type === 'text' ? extractJobFields(item.raw_text || '') : { ...EMPTY_FIELDS });
            const nextStep = item.input_type === 'text' ? 'review' : item.step || (item.extracted ? 'review' : 'input');
            const existing = item.attachments || [];
            setInputType(item.input_type); setAttachments(existing); setText(item.raw_text || '');
            setRecognized(Boolean(item.raw_text)); setTextEdited(Boolean(item.raw_text));
            setFields(nextFields); setStep(nextStep); setSource(item.source_url || ''); setAdditionalText(item.additional_text || ''); setRegions(item.ocr_regions || []);
            savedFiles.current = files;
            setSavedSnapshot(snapshot({ input_type: item.input_type, raw_text: item.raw_text || '', extracted: nextFields, source_url: item.source_url || '', step: nextStep, additional_text: item.additional_text || '', ocr_regions: item.ocr_regions || [] }, files, existing));
        }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) { setBusy(false); setLoadingDraft(false); } });
        return () => { active = false; };
    }, [resume]);
    async function replaceFiles(selection: File[] | (() => Promise<File[]>)) {
        if (busy || changingFiles.current) return;
        changingFiles.current = true;
        setBusy(true); setError('');
        try {
            const next = typeof selection === 'function' ? await selection() : selection;
            await writeDraft(body(fields, { input_type: 'images', ocr_regions: [] }), next, [], true);
            setFiles(next); setAttachments([]); setRegions([]); setCropTarget(null); setOcrResults({}); setRecognized(Boolean(text));
            setTextEdited(Boolean(text)); setOcrErrors([]); setImageErrors({});
        } catch (e) { setError(e instanceof Error ? e.message : '更新截图失败'); }
        finally { changingFiles.current = false; setBusy(false); }
    }
    async function addFiles(incoming: File[]) {
        if (busy || !incoming.length) return;
        const combined = [...files, ...incoming];
        if (combined.length + attachments.length > 5) { setError('一个岗位最多上传5张截图'); return; }
        for (const file of incoming) {
            const issue = validateImage(file.type, file.size);
            if (issue) { setError(issue); return; }
        }
        try { await replaceFiles(async () => attachments.length ? [...await attachmentFiles(), ...combined] : combined); }
        catch (e) { setError(e instanceof Error ? e.message : '读取截图失败'); }
    }
    function swap(index: number, offset: number) {
        const next = [...files]; [next[index], next[index + offset]] = [next[index + offset], next[index]];
        void replaceFiles(next);
    }
    async function persistDraft(nextFields: Fields, overrides: Record<string, unknown> = {}) {
        if (!hasContent && !Object.values(nextFields).some(v => Array.isArray(v) ? v.some(Boolean) : v)) return null;
        return writeDraft(body(nextFields, overrides));
    }
    async function prefill() {
        if (Object.values(fields).some(value => Array.isArray(value) ? value.length : value) && !window.confirm('根据文字重新预填会替换当前表单内容，是否继续？')) return;
        setBusy(true); setError('');
        try { const next = extractJobFields(text); await persistDraft(next, { step: 'review' }); setFields(next); setStep('review'); }
        catch (e) { setError(e instanceof Error ? e.message : '保存失败'); }
        finally { setBusy(false); }
    }
    async function recognize(onlyKey?: string) {
        const total = files.length || attachments.length;
        const retry = !!onlyKey || Object.keys(ocrResults).length > 0 && Object.keys(ocrResults).length < total;
        if (!retry && textEdited && !window.confirm('重新识别会替换已修改的原文，是否继续？')) return;
        const previousKeys = new Set(Object.keys(ocrResults));
        const abort = new AbortController(); controller.current = abort;
        setBusy(true); setError(''); setOcrErrors([]);
        const results = !onlyKey && Object.keys(ocrResults).length === total ? {} as Record<string, string> : { ...ocrResults };
        const issues = onlyKey ? { ...imageErrors } : {} as Record<string, string>;
        if (onlyKey) delete issues[onlyKey];
        const images = files.length ? files.map((file, i) => ({ key: `${i}:${file.name}`, name: file.name, blob: async () => file as Blob })) : attachments.map(a => ({ key: a.id, name: a.name, blob: () => api.file(a.id) }));
        try {
            for (const [index, image] of images.entries()) {
                if (abort.signal.aborted) break;
                if (onlyKey && image.key !== onlyKey) continue;
                if (results[image.key] !== undefined) continue;
                try {
                    setActiveImage(image.key);
                    setProgress(`正在识别第 ${index + 1}/${images.length} 张`);
                    const recognizedText = await recognizeScreenshot(await image.blob(), abort.signal, value => setProgress(`正在识别第 ${index + 1}/${images.length} 张 · ${Math.round(value * 100)}%`), regions[index] || undefined);
                    if (!recognizedText.trim()) throw new Error('未识别到文字，请更换清晰截图');
                    results[image.key] = recognizedText;
                    setOcrResults({ ...results });
                } catch (e) {
                    if (abort.signal.aborted) break;
                    issues[image.key] = `${image.name}：${e instanceof Error ? e.message : '识别失败'}`;
                }
            }
            if (retry && textEdited) {
                const newlyRecognized = images.filter(image => !previousKeys.has(image.key)).map(image => results[image.key] || '').filter(Boolean).join('\n\n');
                if (newlyRecognized) setAdditionalText(value => [value, newlyRecognized].filter(Boolean).join('\n\n').slice(0, 30000));
            } else {
                setText(images.map(image => results[image.key] || '').filter(Boolean).join('\n\n').slice(0, 30000));
                setTextEdited(false); setAdditionalText('');
            }
            setRecognized(true); setOcrErrors(Object.values(issues)); setImageErrors(issues);
            if (abort.signal.aborted) setError('识别已取消，已完成的文字仍可使用');
            else if (!Object.values(results).some(value => value.trim())) setError('未识别到文字，可更换清晰截图或手动填写');
        } finally { controller.current = null; setBusy(false); setActiveImage(null); setProgress(''); }
    }
    async function openCrop(index: number) {
        if (busy) return;
        setBusy(true); setError('');
        try { setCropTarget({ index, file: files[index] || await api.file(attachments[index].id) }); }
        catch (e) { setError(e instanceof Error ? e.message : '读取图片失败'); }
        finally { setBusy(false); }
    }
    function applyCrop(region: OcrRegion) {
        if (!cropTarget) return;
        const index = cropTarget.index, key = files.length ? `${index}:${files[index].name}` : attachments[index].id;
        setRegions(current => Array.from({ length: files.length || attachments.length }, (_, i) => i === index ? region : current[i] || null));
        setOcrResults(current => { const next = { ...current }; delete next[key]; return next; });
        setTextEdited(Boolean(text)); setCropTarget(null);
    }
    function cropControl(index: number) {
        return <button type="button" className="text-button crop-control" disabled={busy} onClick={() => void openCrop(index)}>{regions[index] ? '调整识别区域' : '框选识别区域'}</button>;
    }
    function imageStatus(key: string) {
        const failed = !!imageErrors[key];
        return <div className="image-recognition"><small>{activeImage === key ? '正在识别…' : ocrResults[key] ? '已识别' : failed ? '识别失败' : '待识别'}</small>{failed && <button type="button" className="text-button" disabled={busy} onClick={() => void recognize(key)}>重试此图</button>}</div>;
    }
    async function manual() { setBusy(true); setError(''); try {
        await persistDraft(fields, { step: 'review' });
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
        const savedImportId = await persistDraft(fields);
        await api.request('jobs', 'POST', { ...cleanFields(fields), company: fields.company.trim(), title: fields.title.trim(), import_id: savedImportId, source_url: safeSourceUrl(source), status: '待投递', applied_at: null, notes: '' });
        finished.current = true;
        onSaved();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : '保存失败');
    }
    finally {
        setBusy(false);
    } }
    return <Dialog title={step === 'input' ? '收集一个新机会' : '核对岗位信息'} wide footer={step === 'review' ? <div className="capture-footer">{inputType === 'images' && <button type="button" className="secondary" disabled={busy} onClick={() => setStep('input')}><ArrowLeft size={15}/>返回</button>}<span role="status">{savingDraft ? '正在保存草稿…' : dirty ? '草稿尚未保存' : hasContent ? '草稿已保存' : '仅公司和岗位必填'}</span><button type="submit" form="new-job-form" className="primary" disabled={busy || loadingDraft}>{busy ? <LoaderCircle size={16} className="spin"/> : <Check size={16}/>}保存到岗位列表</button></div> : undefined} onClose={() => void closeWithDraft()}><div className={`dialog-content capture-content ${step === 'review' ? 'capture-review' : ''}`} onPaste={e => { if (inputType !== 'images' || step !== 'input' )
        return; const incoming = Array.from(e.clipboardData.files); if (incoming.length) {
        e.preventDefault();
        addFiles(incoming);
    } }}>
    <div className="stepper"><span className="active"><i>{step === 'review' ? <Check size={12}/> : 1}</i>添加招聘信息</span><b /><span className={step === 'review' ? 'active' : ''}><i>2</i>核对并保存</span></div>
    {confirmClose && <div className="leave-prompt" role="alertdialog" aria-label="保存未完成录入"><strong>有尚未保存的录入内容</strong><div><button className="primary" disabled={busy} autoFocus onClick={keepDraft}>保存草稿并关闭</button><button className="secondary" disabled={busy} onClick={discardDraft}>放弃录入</button><button className="text-button" disabled={busy} onClick={() => setConfirmClose(false)}>继续编辑</button></div></div>}
    {error && <div className="notice error" role="alert">{error}</div>}
    {step === 'input' ? <><label className={`upload-zone ${busy ? 'disabled' : ''}`} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void addFiles(Array.from(e.dataTransfer.files)); }}><input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={e => { addFiles(Array.from(e.target.files || [])); e.target.value = ''; }}/><span className="upload-icon"><ImagePlus size={30}/></span><strong>把岗位截图放在这里</strong><span>点击选择、拖拽图片，或直接 Ctrl / ⌘ + V 粘贴</span><small>同一岗位最多 5 张 · JPG / PNG / WebP · 每张 ≤ 5MB</small></label><div className="image-grid">{files.map((f, i) => <div className="upload-preview" key={`${f.name}-${i}`}><Preview file={f}/><div><span>{i + 1}. {f.name}</span><button disabled={busy || i === 0} className="icon-button" aria-label="前移截图" onClick={() => swap(i, -1)}><ArrowUp size={13}/></button><button disabled={busy || i === files.length - 1} className="icon-button" aria-label="后移截图" onClick={() => swap(i, 1)}><ArrowDown size={13}/></button><button disabled={busy} className="icon-button" aria-label="移除截图" onClick={() => void replaceFiles(files.filter((_, idx) => idx !== i))}><X size={14}/></button></div>{imageStatus(`${i}:${f.name}`)}{cropControl(i)}</div>)}{attachments.map((a, i) => <div key={a.id}><AttachmentImage item={a}/>{imageStatus(a.id)}{cropControl(i)}<div className="attachment-actions"><button className="icon-button" aria-label="前移截图" disabled={busy || i === 0} onClick={() => void editAttachment(i, -1)}><ArrowUp size={14}/></button><button className="icon-button" aria-label="后移截图" disabled={busy || i === attachments.length - 1} onClick={() => void editAttachment(i, 1)}><ArrowDown size={14}/></button><button className="icon-button" aria-label="移除截图" disabled={busy} onClick={() => void editAttachment(i)}><X size={14}/></button></div></div>)}</div><div className="hint"><FileText size={16}/><p>上传同一岗位的介绍和要求，在本机离线识别。<br /><span>一次录入一个岗位，截图与岗位信息一起保存在本地。</span></p></div>
      {cropTarget && <OcrCrop key={cropTarget.index} file={cropTarget.file} initial={regions[cropTarget.index] || undefined} onApply={applyCrop} onCancel={() => setCropTarget(null)}/>}
      {inputType === 'images' && recognized && <label className="text-import">识别原文（可修改）<textarea aria-label="识别原文（可修改）" rows={10} maxLength={30000} value={text} disabled={busy} onChange={e => { setText(e.target.value); setTextEdited(true); }} /></label>}
      {additionalText && <div><button className="secondary" disabled={busy || text.length + additionalText.length + 2 > 30000} onClick={() => { setText([text, additionalText].filter(Boolean).join('\n\n')); setTextEdited(true); setAdditionalText(''); }}>插入原文</button><label className="text-import">重试新增文字<textarea rows={5} value={additionalText} readOnly /></label><p className="form-help">插入会保留已有原文；合并后最多 30000 字。</p></div>}
      {ocrErrors.length > 0 && <div className="notice error" role="alert">{ocrErrors.map(issue => <p key={issue}>{issue}</p>)}</div>}
      {progress && <p role="status">{progress}</p>}
      <div className="dialog-actions">
      {controller.current && <button className="secondary" onClick={() => controller.current?.abort()}>取消识别</button>}
      {inputType === 'images' && <button className="primary" disabled={busy || (!files.length && !attachments.length)} onClick={() => void recognize()}>{recognized ? (ocrErrors.length ? '重试未完成截图' : '重新识别截图') : '离线识别截图'}</button>}
      {text.trim() && <button className="primary" disabled={busy} onClick={prefill}>根据文字预填</button>}
      <button className="secondary" disabled={busy} onClick={manual}>{busy && <LoaderCircle size={16} className="spin"/>}手动填写</button></div></> : <form id="new-job-form" onSubmit={save}><fieldset disabled={busy || loadingDraft}><p className="form-help">预填结果可能有误，请对照原文核对。仅公司和岗位名称必填，其他信息可留空。</p><div className="review-layout"><aside className="review-source">{(text || files.length > 0 || attachments.length > 0) && <details className="source-details" open><summary><FileText size={15}/>核对原始招聘信息</summary>{text && <pre>{text}</pre>}<div className="image-grid">{files.map((f, i) => <figure className="source-image" key={i}><Preview file={f}/></figure>)}{attachments.map(a => <AttachmentImage key={a.id} item={a}/>)}</div></details>}</aside><div className="review-form"><JobForm value={fields} onChange={setFields}><label className="block-label">招聘链接（选填）<input type="url" maxLength={2000} value={source} onChange={e => setSource(e.target.value)} placeholder="https://…"/></label></JobForm></div></div></fieldset></form>}
    <p className="local-foot" role="status">{savingDraft ? '正在保存草稿…' : dirty ? '草稿尚未保存' : hasContent ? '草稿已保存 · 数据保存在本机' : '数据保存在本机'}</p>
  </div></Dialog>;
}
