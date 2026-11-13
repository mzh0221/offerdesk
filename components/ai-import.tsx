import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowRight, Asterisk, Braces, Check, CircleCheck, CircleX, Code, Copy, LoaderCircle, PanelsTopLeft, Plug, Sparkles, Terminal, Workflow } from 'lucide-react';
import Dialog from './dialog';
import McpManualSetup from './mcp-manual-setup';
import type { AutoMcpPlan, AutoMcpResult, HarnessConfig } from '@/lib/external-import-bridge';

const toolIcons = { codex: Terminal, claude: Asterisk, 'deepseek-harness': Workflow, zcode: Braces, workbuddy: PanelsTopLeft, opencode: Code };
type Step = 'connect' | 'verify' | 'collect';
const steps: { id: Step; title: string }[] = [{ id: 'connect', title: '连接工具' }, { id: 'verify', title: '验证连接' }, { id: 'collect', title: '开始采集' }];
function ServiceStatus({ state, clientName, detail }: { state: 'success' | 'error' | 'checking'; clientName: string; detail?: string }) {
    const Icon = state === 'success' ? CircleCheck : state === 'error' ? CircleX : LoaderCircle;
    return <div className={`mcp-status mcp-status--${state}`} role={state === 'error' ? 'alert' : 'status'} aria-label="OfferDesk 本机服务状态">
        <span className="mcp-status-icon"><Icon size={23} className={state === 'checking' ? 'spin' : undefined} aria-hidden="true"/></span>
        <div><strong>{state === 'success' ? 'OfferDesk 服务自检通过' : state === 'error' ? 'OfferDesk 服务自检未通过' : '正在自检 OfferDesk 服务'}</strong><p>{detail || (state === 'success' ? `仅说明 OfferDesk 本机服务可用，未检查 ${clientName} 是否打开或已连接。` : state === 'error' ? '请核对应用路径与启动参数后重试。' : '正在进行只读检查，不会导入岗位。')}</p></div>
    </div>;
}
export default function AiImport({ onClose }: { onClose(): void }) {
    const [configs, setConfigs] = useState<HarnessConfig[]>([]);
    const [selected, setSelected] = useState('codex');
    const [variant, setVariant] = useState<'code' | 'desktop'>('desktop');
    const [step, setStep] = useState<Step>('connect');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [autoPlan, setAutoPlan] = useState<AutoMcpPlan | null>(null);
    const [autoResult, setAutoResult] = useState<AutoMcpResult | null>(null);
    const [autoError, setAutoError] = useState('');
    const [autoBusy, setAutoBusy] = useState<'detect' | 'apply' | 'check' | null>(null);
    const [manualOpen, setManualOpen] = useState(false);
    const [serviceReady, setServiceReady] = useState<boolean | null>(null);
    const [serviceIssue, setServiceIssue] = useState('');
    const requestId = useRef(0);
    const stageRef = useRef<HTMLElement>(null);
    const config = configs.find(item => item.id === selected);
    const clientName = selected === 'claude' ? (variant === 'desktop' ? 'Claude Desktop' : 'Claude Code') : config?.name || 'AI 工具';
    const locked = autoBusy === 'apply' || autoBusy === 'check';
    const stepIndex = steps.findIndex(item => item.id === step);
    useEffect(() => {
        let active = true;
        window.externalImports?.configs().then(items => { if (active) setConfigs(items); }).catch(error => { if (active) setError(error.message); });
        return () => { active = false; };
    }, []);
    // Detection only reads configuration. Stale responses cannot replace the newly selected tool.
    useEffect(() => {
        if (config) void prepareAuto();
        return () => { requestId.current++; };
    }, [selected, variant, configs]);
    function go(next: Step) {
        setStep(next); setMessage(''); setError('');
        if (next === 'connect' && !autoPlan && !autoBusy) void prepareAuto();
        requestAnimationFrame(() => { stageRef.current?.focus({ preventScroll: true }); stageRef.current?.scrollIntoView({ block: 'start' }); });
    }
    function chooseTool(id: string) {
        if (locked) return;
        if (id === selected) { go('connect'); return; }
        setStep('connect'); setMessage(''); setError(''); setManualOpen(false);
        if (id !== selected) { requestId.current++; setAutoPlan(null); setAutoResult(null); setAutoError(''); setServiceReady(null); setServiceIssue(''); setSelected(id); }
    }
    async function prepareAuto() {
        if (!window.externalImports || !config || locked) return;
        const id = ++requestId.current;
        setAutoBusy('detect'); setAutoPlan(null); setAutoResult(null); setAutoError(''); setServiceReady(null); setServiceIssue('');
        try { const plan = await window.externalImports.prepareAuto(selected, variant); if (id === requestId.current) setAutoPlan(plan); }
        catch (error) { if (id === requestId.current) setAutoError(error instanceof Error ? error.message : '暂时无法自动配置，请使用手动方式'); }
        finally { if (id === requestId.current) setAutoBusy(null); }
    }
    async function applyAuto() {
        if (!window.externalImports || !autoPlan?.ready || autoBusy) return;
        const id = requestId.current;
        setAutoBusy('apply'); setAutoError('');
        try {
            const result = await window.externalImports.applyAuto(autoPlan.token);
            if (id !== requestId.current) return;
            setAutoResult(result); setAutoPlan(null); go('verify');
        } catch (error) { if (id === requestId.current) { setAutoError(error instanceof Error ? error.message : '配置失败，请重新检测'); setAutoPlan(null); } }
        finally { if (id === requestId.current) setAutoBusy(null); }
    }
    async function checkService() {
        if (!window.externalImports || autoBusy) return;
        setAutoBusy('check'); setServiceReady(null); setServiceIssue('');
        try { setServiceReady(await window.externalImports.checkService()); }
        catch { setServiceReady(false); setServiceIssue('无法完成 OfferDesk 服务自检。请重试，或重新加载 AI 工具的 MCP 连接。'); }
        finally { setAutoBusy(null); }
    }
    async function copy(text: string, feedback: string) {
        try {
            if (!window.externalImports) throw new Error('桌面复制接口不可用');
            await window.externalImports.copyText(text); setError(''); setMessage(feedback);
        } catch { setError('复制失败，请选中文本后按系统复制快捷键'); }
    }
    return <Dialog title="AI 采集与导入" wide onClose={() => { if (autoBusy !== 'apply') onClose(); }}>
        <div className="dialog-content ai-import ai-connect">
            <div className="connect-intro"><span className="connect-eyebrow"><Sparkles size={14}/>让 AI 收集机会</span><h3>接上你的 AI，岗位直接收进来。</h3><p>保持 OfferDesk 打开，在同一台电脑上连接你常用的 AI 工具。</p></div>
            <ol className="connect-steps" aria-label="接入步骤">{steps.map((item, index) => <li key={item.id} className={index === stepIndex ? 'is-current' : index < stepIndex ? 'is-done' : ''} aria-current={index === stepIndex ? 'step' : undefined}><span>{index < stepIndex ? <Check size={13}/> : index + 1}</span>{item.title}{index < 2 && <i/>}</li>)}</ol>
            <div className="tool-picker" role="group" aria-label="选择 AI 工具">{configs.map((item, index) => {
                const Icon = toolIcons[item.id as keyof typeof toolIcons] || Plug;
                return <button key={item.id} type="button" className="tool-option" disabled={locked} style={{ '--tool-index': index } as CSSProperties} aria-label={item.name} aria-pressed={selected === item.id} onClick={() => chooseTool(item.id)}><span className="tool-icon"><Icon size={18} aria-hidden="true"/></span><span className="tool-copy"><strong>{item.name}</strong></span>{selected === item.id && <Check className="tool-selected" size={13} aria-hidden="true"/>}</button>;
            })}</div>
            {config && <div key={config.id} className="tool-configuration" role="region" aria-label={`${config.name} 接入配置`}>
                {selected === 'claude' && <div className="auto-variants" role="group" aria-label="Claude 客户端">{(['desktop', 'code'] as const).map(value => <button className="secondary" key={value} disabled={locked} aria-pressed={variant === value} onClick={() => { if (value !== variant) { requestId.current++; setVariant(value); setStep('connect'); setAutoPlan(null); setAutoResult(null); setMessage(''); setManualOpen(false); } }}>{value === 'desktop' ? 'Claude Desktop' : 'Claude Code'}</button>)}</div>}
                <section className="connect-stage" ref={stageRef} tabIndex={-1} aria-label={step === 'connect' ? '本机自动配置' : step === 'verify' ? '验证客户端连接' : '采集任务'}>
                    {step === 'connect' && <>
                        <div className="connect-stage-heading"><span className="connect-stage-icon"><Plug size={23}/></span><div><span className="connect-kicker">第一步 · 连接工具</span><h4>连接 {clientName}</h4></div></div>
                        {autoBusy === 'detect' ? <p className="connect-detect"><LoaderCircle size={16} className="spin"/>正在查找可用配置…</p> : <>
                            {autoPlan?.ready ? <div className="auto-plan"><p><Check size={15}/>{autoPlan.configured ? '已有 OfferDesk 配置，可以直接验证。' : '可以自动配置，其他服务器和模型设置保留。'}</p><code>{autoPlan.target}</code></div> : <div className="connect-fallback"><p>{selected === 'deepseek-harness' ? 'DSH 需要通过补丁接入，按下方三步操作即可。' : '暂时无法自动配置，你也可以复制配置手动接入。'}</p><details><summary>查看检测详情</summary><p>{autoError || autoPlan?.message}</p>{autoPlan?.target && <code>{autoPlan.target}</code>}</details></div>}
                            <div className="connect-actions">
                                {autoPlan?.ready ? <button className="primary" disabled={!!autoBusy} onClick={() => autoPlan.configured ? go('verify') : void applyAuto()}>{autoBusy === 'apply' ? <LoaderCircle size={16} className="spin"/> : <Plug size={16}/>} {autoBusy === 'apply' ? '正在连接…' : autoPlan.configured ? '下一步：验证连接' : `连接 ${clientName}`}</button> : <button className="primary" disabled={!!autoBusy} onClick={() => { setManualOpen(true); void copy(config.config, '配置已复制，按下方步骤添加到 AI 工具'); }}><Copy size={16}/>{config.configLabel ? `复制${config.configLabel}` : '复制 MCP 配置'}</button>}
                                <button className="text-button" disabled={!!autoBusy} onClick={() => go('verify')}>已配置，直接验证<ArrowRight size={14}/></button>
                            </div>
                            {autoError && <p className="connect-error" role="alert">{autoError}</p>}
                            <button className="text-button connect-retry" disabled={!!autoBusy} onClick={() => void prepareAuto()}>重新检测</button>
                        </>}
                    </>}
                    {step === 'verify' && <>
                        <div className="connect-stage-heading"><span className="connect-stage-icon"><Terminal size={23}/></span><div><span className="connect-kicker">第二步 · 验证连接</span><h4>去 {clientName} 发一条消息</h4></div></div>
                        {autoResult && <p className="auto-result"><Check size={15}/>配置已写入，接下来验证实际连接。</p>}
                        <ol className="verify-instructions"><li>在 {clientName} 中重新加载 MCP，或重新打开会话。</li><li>复制下面的消息，粘贴到 AI 对话并发送。</li></ol>
                        <div className="verify-message"><textarea aria-label="连接检查提示词" readOnly rows={3} value={config.verifyPrompt}/></div>
                        <div className="connect-actions"><button className="primary" disabled={locked} onClick={() => void copy(config.verifyPrompt, `验证提示词已复制，去 ${clientName} 粘贴发送`)}><Copy size={16}/>复制验证提示词</button><button className="text-button" disabled={locked} onClick={() => go('connect')}>返回配置</button></div>
                        <p className="verify-expectation">看到真实工具调用，并返回 <code>version: 1</code> 和每批 <code>50</code> 条，才算连接成功。</p>
                        <div className="verify-continue"><span>确认 AI 已成功返回结果后</span><button className="secondary" disabled={locked} onClick={() => go('collect')}>我已验证，下一步<ArrowRight size={15}/></button></div>
                    </>}
                    {step === 'collect' && <>
                        <div className="connect-stage-heading"><span className="connect-stage-icon"><Sparkles size={23}/></span><div><span className="connect-kicker">第三步 · 开始采集</span><h4>告诉 AI，你想找什么岗位</h4></div></div>
                        <p>复制任务到 {clientName}，把岗位、城市和条件改成自己的目标后发送。</p>
                        <div className="task-example"><span>示例任务</span><strong>杭州 / 上海 · 前端实习</strong><small>读取完整岗位详情，导入 OfferDesk 待核对草稿。</small></div>
                        <div className="connect-actions"><button className="primary" disabled={locked} onClick={() => void copy(config.taskPrompt, `采集任务已复制，去 ${clientName} 粘贴并修改目标`)}><Copy size={16}/>复制采集任务</button><button className="text-button" disabled={locked} onClick={() => go('verify')}>返回验证</button></div>
                        <details className="task-preview"><summary>查看完整任务内容</summary><textarea aria-label="采集任务提示词" readOnly rows={6} value={config.taskPrompt}/></details>
                        <div className="collection-destination"><Check size={16}/><span>AI 导入后，回到首页“外部导入待核对”核对并保存。</span></div>
                    </>}
                    {message && <p className="copy-feedback" role="status" aria-label="操作反馈"><Check size={14}/>{message}</p>}
                    {error && <p className="connect-error" role="alert">{error}</p>}
                </section>
                <div className="connect-secondary"><McpManualSetup config={config} open={manualOpen} onToggle={setManualOpen} copy={copy}/>
                    <details className="connection-troubleshooting"><summary>连接故障排查</summary><p>AI 提示“找不到工具”或“Transport closed”？先在 {clientName} 中重新加载 offerdesk 连接，再重试验证消息。仍失败时可自检 OfferDesk 服务；自检结果不代表 AI 已连接。</p><button className="secondary" disabled={!!autoBusy} onClick={() => void checkService()}>{autoBusy === 'check' && <LoaderCircle size={15} className="spin"/>}自检 OfferDesk 服务</button>{autoBusy === 'check' ? <ServiceStatus state="checking" clientName={clientName}/> : serviceReady !== null && <ServiceStatus state={serviceReady ? 'success' : 'error'} clientName={clientName} detail={serviceIssue || undefined}/>}</details>
                </div>
            </div>}
            {!config && !error && <p className="connect-detect"><LoaderCircle size={16} className="spin"/>正在加载连接方式…</p>}
            {!config && error && <p className="notice error" role="alert">{error}</p>}
            <p className="connect-local-note">岗位先进入待核对草稿，由你确认保存。连接期间请保持 OfferDesk 打开。</p>
        </div>
    </Dialog>;
}
