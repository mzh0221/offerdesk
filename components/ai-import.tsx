import { useEffect, useState } from 'react';
import Dialog from './dialog';
import { localClient } from '@/lib/local-client';

type Config = { id: string; name: string; destination: string; config: string; kind?: 'file'; configLabel?: string; taskPrompt?: string };
export default function AiImport({ onClose, onImported }: { onClose(): void; onImported(): void }) {
    const [configs, setConfigs] = useState<Config[]>([]);
    const [selected, setSelected] = useState('codex');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        let active = true;
        window.externalImports?.configs().then(items => { if (active) setConfigs(items); }).catch(error => { if (active) setError(error.message); });
        return () => { active = false; };
    }, []);
    const config = configs.find(item => item.id === selected);
    async function importFile(file?: File) {
        if (!file || busy) return;
        setBusy(true); setError(''); setMessage('');
        try {
            const result = await localClient.importJson(file);
            const count = (status: string) => result.results.filter(item => item.status === status).length;
            setMessage(`已创建 ${count('created')} 条草稿，重复 ${count('duplicate')} 条，失败 ${count('invalid')} 条。`);
            const failures = result.results.filter(item => item.status === 'invalid');
            if (failures.length) setError(failures.map(item => `第 ${item.index + 1} 条：${item.error}`).join('\n'));
            onImported();
        } catch (error) { setError(error instanceof Error ? error.message : '导入失败'); }
        finally { setBusy(false); }
    }
    return <Dialog title="AI 工具接入" onClose={onClose}><div className="dialog-content guide ai-import">
        <p>让外部 AI 采集岗位，导入 OfferDesk 待核对草稿。连接与采集工具须在同一台电脑运行，导入时保持 OfferDesk 打开。</p>
        <label>选择 AI 工具<select aria-label="选择 AI 工具" value={selected} onChange={event => { setSelected(event.target.value); setMessage(''); setError(''); }}>{configs.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        {config && <><p>{config.destination}。</p>{config.kind !== 'file' && <p>保留已有配置，只合并 OfferDesk 条目，再重新加载客户端配置。</p>}<textarea aria-label={config.configLabel || 'MCP 配置'} rows={10} readOnly value={config.config} onFocus={event => event.target.select()}/><button className="secondary" onClick={() => { void navigator.clipboard.writeText(config.config).then(() => setMessage('配置已复制')).catch(() => setError('请选中配置文本后按系统复制快捷键')); }}>{config.kind === 'file' ? '复制 JSON 示例' : '复制配置'}</button>{config.taskPrompt && <><label>采集任务提示词<textarea aria-label="采集任务提示词" rows={6} readOnly value={config.taskPrompt} onFocus={event => event.target.select()}/></label><button className="secondary" onClick={() => { void navigator.clipboard.writeText(config.taskPrompt!).then(() => setMessage('提示词已复制')).catch(() => setError('请选中提示词文本后按系统复制快捷键')); }}>复制采集提示词</button></>}</>}
        {config?.kind !== 'file' && <p>先让 AI 调用 get_import_spec 查看格式，再调用 import_jobs。AI 需要自行具备搜索或浏览器能力；此入口只提供本地导入。</p>}
        <hr/><h3>通过 JSON 文件导入</h3><p>豆包等工具若无法连接本地 MCP，可以生成相同格式的 JSON 文件，在此导入。支持 batch_id 与 jobs，每批最多 50 条、文件不超过 4MB。</p>
        <label>选择岗位 JSON 文件<input aria-label="选择岗位 JSON 文件" type="file" accept=".json,application/json" disabled={busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void importFile(file); }}/></label>
        {busy && <p role="status">正在导入…</p>}{message && <p role="status">{message}</p>}{error && <div className="notice error" role="alert" style={{ whiteSpace: 'pre-wrap' }}>{error}</div>}
    </div></Dialog>;
}
