import { useEffect, useState, type CSSProperties } from 'react';
import Dialog from './dialog';
import { Asterisk, Braces, Check, Code, Copy, LoaderCircle, PanelsTopLeft, Plug, Terminal, Workflow } from 'lucide-react';
import type { AutoMcpPlan, AutoMcpResult, HarnessConfig } from '@/lib/external-import-bridge';

const toolIcons = { codex: Terminal, claude: Asterisk, 'deepseek-harness': Workflow, zcode: Braces, workbuddy: PanelsTopLeft, opencode: Code };
export default function AiImport({ onClose }: { onClose(): void }) {
    const [configs, setConfigs] = useState<HarnessConfig[]>([]);
    const [selected, setSelected] = useState('codex');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [variant, setVariant] = useState<'code' | 'desktop'>('desktop');
    const [autoPlan, setAutoPlan] = useState<AutoMcpPlan | null>(null);
    const [autoResult, setAutoResult] = useState<AutoMcpResult | null>(null);
    const [autoError, setAutoError] = useState('');
    const [autoBusy, setAutoBusy] = useState<'detect' | 'apply' | 'check' | null>(null);
    const [serviceReady, setServiceReady] = useState<boolean | null>(null);
    useEffect(() => {
        let active = true;
        window.externalImports?.configs().then(items => { if (active) setConfigs(items); }).catch(error => { if (active) setError(error.message); });
        return () => { active = false; };
    }, []);
    const config = configs.find(item => item.id === selected);
    function resetAuto() { setAutoPlan(null); setAutoResult(null); setAutoError(''); setServiceReady(null); }
    async function prepareAuto() {
        if (!window.externalImports || autoBusy) return;
        setAutoBusy('detect'); resetAuto();
        try { setAutoPlan(await window.externalImports.prepareAuto(selected, variant)); }
        catch (error) { setAutoError(error instanceof Error ? error.message : '检测失败，请使用手动配置'); }
        finally { setAutoBusy(null); }
    }
    async function applyAuto() {
        if (!window.externalImports || !autoPlan?.ready || autoBusy) return;
        setAutoBusy('apply'); setAutoError('');
        try {
            const result = await window.externalImports.applyAuto(autoPlan.token);
            setAutoResult(result); setServiceReady(result.serviceReady); setAutoPlan(null);
        } catch (error) { setAutoError(error instanceof Error ? error.message : '配置失败，请重新检测'); setAutoPlan(null); }
        finally { setAutoBusy(null); }
    }
    async function checkService() {
        if (!window.externalImports || autoBusy) return;
        setAutoBusy('check'); setAutoError('');
        try { setServiceReady(await window.externalImports.checkService()); }
        catch { setAutoError('无法完成服务自检，请使用下方检查提示词排查'); }
        finally { setAutoBusy(null); }
    }
    async function copy(text: string, feedback: string) {
        try {
            if (!window.externalImports) throw new Error('桌面复制接口不可用');
            await window.externalImports.copyText(text); setError(''); setMessage(feedback);
        }
        catch { setError('请选中文本后按系统复制快捷键'); }
    }
    return <Dialog title="AI 采集与导入" wide onClose={() => { if (autoBusy !== 'apply') onClose(); }}><div className="dialog-content ai-import">
        <p className="integration-intro">MCP 让 AI 将岗位直接导入 OfferDesk。服务已内置，无需另装 Node.js 或填写模型密钥。先打开 OfferDesk，再在同一台电脑上的 AI 工具中完成连接。</p>
        <section className="integration-section">
            <div className="integration-heading"><h3>选择 MCP 工具</h3></div>
            <div className="tool-picker" role="group" aria-label="选择 AI 工具">{configs.map((item, index) => {
                const Icon = toolIcons[item.id as keyof typeof toolIcons] || Plug;
                return <button key={item.id} type="button" className="tool-option" disabled={!!autoBusy} style={{ '--tool-index': index } as CSSProperties} aria-label={item.name} aria-pressed={selected === item.id} onClick={() => { setSelected(item.id); setMessage(''); setError(''); resetAuto(); }}>
                    <span className="tool-icon"><Icon size={19} strokeWidth={1.7} aria-hidden="true"/></span>
                    <span className="tool-copy"><strong>{item.name}</strong><small>{item.subtitle}</small></span>
                    {selected === item.id && <Check className="tool-selected" size={14} aria-hidden="true"/>}
                </button>;
            })}</div>
            {config && <div key={config.id} className="tool-configuration" role="region" aria-label={`${config.name} 接入配置`}>
                <section className="auto-setup" aria-label="本机自动配置">
                    <div className="auto-setup-title"><Plug size={17}/><h4>自动配置本机 MCP</h4></div>
                    <p>检测本机工具，预览目标位置后写入 offerdesk 连接。其他服务器和模型设置保留。</p>
                    {selected === 'claude' && <div className="auto-variants" role="group" aria-label="Claude 客户端">{(['desktop', 'code'] as const).map(value => <button className="secondary" key={value} disabled={!!autoBusy} aria-pressed={variant === value} onClick={() => { setVariant(value); resetAuto(); }}>{value === 'desktop' ? 'Claude Desktop' : 'Claude Code'}</button>)}</div>}
                    {autoPlan && <div className="auto-plan"><p>{autoPlan.message}</p>{autoPlan.target && <p><span>目标位置</span><code>{autoPlan.target}</code></p>}{autoPlan.method && <p><span>写入方式</span>{autoPlan.method}{autoPlan.configured ? ' · 该连接已配置，无需重复写入' : ''}</p>}</div>}
                    {autoResult && <p className="auto-result" role="status"><Check size={15}/>{autoResult.message}</p>}
                    <div className="auto-actions">
                        {autoPlan?.ready ? <button className="primary ai-action" disabled={!!autoBusy} onClick={() => void applyAuto()}>{autoBusy === 'apply' ? <LoaderCircle size={15} className="spin"/> : <Plug size={15}/>}写入配置并检查</button> : <button className="primary ai-action" disabled={!!autoBusy} onClick={() => void prepareAuto()}>{autoBusy === 'detect' && <LoaderCircle size={15} className="spin"/>}{autoResult ? '重新检测配置' : '检测并预览'}</button>}
                        <button className="secondary" disabled={!!autoBusy} onClick={() => void checkService()}>{autoBusy === 'check' && <LoaderCircle size={15} className="spin"/>}检查 MCP 服务</button>
                        {autoPlan?.ready && <button className="text-button" disabled={!!autoBusy} onClick={resetAuto}>取消</button>}
                    </div>
                    {autoBusy === 'apply' && <p role="status">正在配置并进行只读自检，请稍候…</p>}
                    {serviceReady !== null && <p className={serviceReady ? 'success' : 'auto-check-failed'} role="status">{serviceReady ? 'MCP 服务自检通过，服务可用。' : 'MCP 服务自检未通过，请核对应用路径与参数。'}</p>}
                    {autoError && <div className="notice error" role="alert">{autoError}</div>}
                    <p className="auto-reload-note">最后一步：在 AI 工具中重新加载 MCP 或新开会话，再发送下方连接检查提示词。服务自检不会导入岗位。</p>
                </section>
                <details className="manual-setup"><summary>手动配置与参数</summary>
                <div className="setup-guide"><h4>在 {config.name} 中完成设置</h4><ol>{config.setup.steps.map(step => <li key={step}>{step}</li>)}</ol></div>
                {config.connection && <details className="connection-form" open={config.id === 'codex'}>
                    <summary>{config.id === 'codex' ? '按表单逐项填写（推荐）' : '界面要求填启动命令？查看 STDIO 表单值'}</summary>
                    <p className="form-help">类型选择 STDIO / 本地命令。以下数值已按当前应用位置生成，复制后无需替换路径。</p>
                    <dl className="connection-fields">
                        <div><dt>名称</dt><dd><code>offerdesk</code></dd></div>
                        <div><dt>类型</dt><dd>STDIO（本地命令）</dd></div>
                        <div><dt>启动命令</dt><dd><input aria-label="MCP 启动命令" readOnly value={config.connection.command} onFocus={event => event.target.select()}/><button className="text-button" onClick={() => void copy(config.connection!.command, '启动命令已复制')}><Copy size={13}/>复制启动命令</button></dd></div>
                        <div><dt>参数</dt><dd><ol className="connection-args">{config.connection.args.map((arg, index) => <li key={index}><span>参数 {index + 1}</span><input aria-label={`MCP 参数 ${index + 1}`} readOnly value={arg} onFocus={event => event.target.select()}/><button className="text-button" aria-label={`复制参数 ${index + 1}`} onClick={() => void copy(arg, `参数 ${index + 1} 已复制`)}><Copy size={13}/></button></li>)}</ol><p>点击“添加参数”，按上面的顺序逐项添加。不要把整段 JSON、数组括号或额外引号填进参数栏。</p></dd></div>
                        <div><dt>环境变量</dt><dd>留空；“环境变量传递”也留空。</dd></div>
                        <div><dt>工作目录</dt><dd>可留空。如果工具要求必填，可复制：<input aria-label="MCP 工作目录" readOnly value={config.connection.cwd} onFocus={event => event.target.select()}/><button className="text-button" onClick={() => void copy(config.connection!.cwd, '工作目录已复制')}><Copy size={13}/>复制工作目录</button></dd></div>
                    </dl>
                    <p>不用填写服务器 URL，也不用把启动命令粘贴到终端运行。AI 工具会自动启动 MCP 服务。</p>
                </details>}
                <details className="config-file-guide" open={config.id !== 'codex'}>
                    <summary>{config.id === 'codex' ? '或编辑配置文件（与表单任选一种）' : '复制到配置文件'}</summary>
                    {config.setup.file && <p className="config-location"><strong>位置：</strong><code>{config.setup.file}</code></p>}
                    {config.setup.merge && <p>{config.setup.merge}</p>}
                    <div className="config-block">
                    <div className="config-toolbar"><span>{config.configLabel || 'MCP 配置'}</span><button className="text-button" onClick={() => void copy(config.config, '配置已复制')}><Copy size={13}/>复制配置</button></div>
                    <textarea aria-label={config.configLabel || 'MCP 配置'} rows={8} wrap="off" readOnly value={config.config} onFocus={event => event.target.select()}/>
                    </div>
                </details>
                </details>
                {config.verifyPrompt && <div className="connection-check"><h4>检查是否连通</h4><p>保存并重启连接后，在 AI 对话中发送下面这段。成功时应实际返回格式版本与每批最多 50 条；仅看到“已添加”还不代表工具能调用。</p><div className="config-block"><div className="config-toolbar"><span>只读连接检查</span><button className="text-button" onClick={() => void copy(config.verifyPrompt!, '检查提示词已复制')}><Copy size={13}/>复制检查提示词</button></div><textarea aria-label="连接检查提示词" rows={3} readOnly value={config.verifyPrompt} onFocus={event => event.target.select()}/></div></div>}
                {config.taskPrompt && <div className="config-block">
                    <div className="config-toolbar"><span>采集任务提示词</span><button className="text-button" onClick={() => void copy(config.taskPrompt!, '提示词已复制')}><Copy size={13}/>复制采集提示词</button></div>
                    <textarea aria-label="采集任务提示词" rows={6} readOnly value={config.taskPrompt} onFocus={event => event.target.select()}/>
                </div>}
            </div>}
            <p>检查通过后，将“采集任务提示词”中的岗位与城市改为自己的目标，再发送给 AI。搜索由 AI 工具完成，导入结果会出现在 OfferDesk 的“外部导入待核对”中。</p>
        </section>
        {message && <p className="success" role="status">{message}</p>}{error && <div className="notice error" role="alert" style={{ whiteSpace: 'pre-wrap' }}>{error}</div>}
    </div></Dialog>;
}
